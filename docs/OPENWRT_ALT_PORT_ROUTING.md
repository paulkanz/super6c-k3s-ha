# OpenWrt Alternate Port Routing & Dual-Cluster Coexistence Guide
## Exposing K3s on WAN Port 8443 with OpenWrt Port Translation

**Date:** 2026-09-12  
**Target:** K3s HA Cluster Virtual IP (`192.168.1.130:443`)  
**Gateway:** OpenWrt 23.05.5 Gateway Router  
**Objective:** Expose K3s dashboards (`headlamp.example.com:8443` & `longhorn.example.com:8443`) while allowing an existing legacy edge gateway to continue using standard WAN port 443 during phased migration.

---

## 1. Architecture & Port Mapping Overview

By leveraging OpenWrt's **Destination NAT (DNAT) Port Translation**, external traffic hitting port `8443` is transparently redirected to port `443` on the K3s cluster. Both clusters can run in parallel on the same public IP without port collisions.

| Service / Cluster | External WAN URL | OpenWrt WAN Port | Internal Destination IP | Internal Destination Port |
| :--- | :--- | :--- | :--- | :--- |
| **Existing Legacy Gateway** | `https://*.example.com` | **TCP 443** | Legacy VIP / Host IP | `443` |
| **K3s Headlamp Dashboard** | `https://headlamp.example.com:8443` | **TCP 8443** | `192.168.1.130` (K3s VIP) | `443` (Traefik TLS) |
| **K3s Longhorn Dashboard** | `https://longhorn.example.com:8443` | **TCP 8443** | `192.168.1.130` (K3s VIP) | `443` (Traefik TLS) |
| **Let's Encrypt HTTP-01** | `http://<domain>/.well-known/...` | **TCP 80** | See Section 3 below | `80` (ACME Validation) |

---

## 2. OpenWrt Configuration Steps

### Method A: Via OpenWrt LuCI Web Interface

1. Log into your OpenWrt LuCI dashboard (`http://192.168.1.1`).
2. Navigate to **Network $\rightarrow$ Firewall $\rightarrow$ Port Forwards**.
3. Scroll down to **Add new port forward** and configure:
   * **Name:** `K3s-Traefik-HTTPS-Alt`
   * **Protocol:** `TCP`
   * **Source zone:** `wan`
   * **External port:** `8443`
   * **Destination zone:** `lan`
   * **Internal IP address:** `192.168.1.130`
   * **Internal port:** `443`
4. Click **Add and edit...**.
5. In the advanced settings modal, confirm:
   * **Enable NAT Loopback:** `Checked` *(Ensures you can access `:8443` from inside your home network without routing out to the internet).*
6. Click **Save $\rightarrow$ Save & Apply**.

---

### Method B: Via OpenWrt SSH / CLI (`/etc/config/firewall`)

Append the following block to `/etc/config/firewall` on your OpenWrt router:

```uci
config redirect
	option name 'K3s-Traefik-HTTPS-Alt'
	option src 'wan'
	option src_dport '8443'
	option dest 'lan'
	option dest_ip '192.168.1.130'
	option dest_port '443'
	option proto 'tcp'
	option target 'DNAT'
	option reflection '1'
```

Apply the changes immediately:
```bash
/etc/init.d/firewall restart
```

---

## 3. Let's Encrypt ACME HTTP-01 Validation Options During Coexistence

Let's Encrypt **requires Port 80** for HTTP-01 challenges. Because your external HTTPS traffic will run on port `8443`, you have three clean options to solve the challenge on port 80:

### Option 1: Temporary Port 80 Forward Flip (Simplest)
1. Point WAN Port 80 to `192.168.1.130:80` in OpenWrt.
2. `cert-manager` on K3s automatically solves the HTTP-01 challenge and issues the certificate (takes ~30-60 seconds).
3. Once the certificate is issued (valid for 90 days), you can revert Port 80 back to the legacy gateway if needed, or leave it pointed to K3s.

### Option 2: Proxy ACME Challenges from Legacy Gateway to K3s (Zero-Downtime Coexistence)
If WAN Port 80 must stay permanently on the legacy gateway during migration, the edge proxy can act as an HTTP-01 pass-through for K3s domains:
1. In Kong's configuration (`kong.yml`), add an upstream route for `headlamp.example.com` and `longhorn.example.com` matching path `/.well-known/acme-challenge`.
2. Target URL: `http://192.168.1.130:80`.
3. Incoming Let's Encrypt validation requests will hit Kong on Port 80, which forwards them directly to K3s Traefik.

### Option 3: Permanent Port 80 Cutover to K3s
Move WAN Port 80 to `192.168.1.130:80`. Any non-ACME traffic for legacy services can be redirected or handled while K3s handles all renewals.

---

## 4. Traefik Routing & Port Preservation

When a client accesses `https://headlamp.example.com:8443`:

1. **Host Header**: The browser sends `Host: headlamp.example.com:8443`.
2. **SNI Matching**: Traefik's `Host(headlamp.example.com)` rule matches the domain name regardless of the port number.
3. **Redirect Preservation**:
   Our redirect middleware in [`templates/headlamp.yaml.j2`](templates/headlamp.yaml.j2) uses regex substitution:
   ```yaml
   spec:
     redirectRegex:
       regex: "^(https?://[^/]+)/?$"
       replacement: "${1}/headlamp/"
   ```
   Because `${1}` matches the full protocol and authority (`https://headlamp.example.com:8443`), browser redirects cleanly maintain the `:8443` port:
   `https://headlamp.example.com:8443` $\rightarrow$ `https://headlamp.example.com:8443/headlamp/`.

---

## 5. Verification Commands

### Test Alternate Port Routing Internally (Bypassing Router)
```bash
curl -k -s -I --resolve headlamp.example.com:443:192.168.1.130 https://headlamp.example.com/
```
*Expected: HTTP/2 307 Redirect to `/headlamp/`.*

### Test Alternate Port Routing through OpenWrt (from WAN or LAN)
Once port 8443 is forwarded:
```bash
curl -k -s -I https://headlamp.example.com:8443/
```
*Expected: HTTP/2 307 Redirect to `https://headlamp.example.com:8443/headlamp/`.*

### Test Longhorn UI on Alternate Port
```bash
# Unauthenticated request:
curl -k -s -I https://longhorn.example.com:8443/
# Expected: HTTP/2 401 Unauthorized (Basic realm="traefik")

# Authenticated request:
curl -k -s -I -u 'kube-admin:<admin-password>' https://longhorn.example.com:8443/
# Expected: HTTP/2 200 OK
```
