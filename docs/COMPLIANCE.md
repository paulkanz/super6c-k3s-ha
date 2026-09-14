# Security & Compliance Crosswalk

This document details how this K3s automation implements security controls aligned with **NIST SP 800-53 Rev 5**, **SOC 2 Type II (Trust Services Criteria)**, and the **HITRUST CSF v9.x** security framework.

---

## 1. Compliance Mapping Matrix

| Domain | Framework Reference | Applied Implementation | Ansible Source |
| :--- | :--- | :--- | :--- |
| **Access Control (AC)** | **NIST:** AC-2, AC-3, AC-6, AC-17<br>**SOC 2:** CC6.1, CC6.2, CC6.3<br>**HITRUST:** 01.b, 01.c | • Password authentication disabled on SSH (`PasswordAuthentication no`)<br>• Root SSH login disabled (`PermitRootLogin no`)<br>• SSH key-only authentication enforced (`PubkeyAuthentication yes`)<br>• Idle session termination (`ClientAliveInterval 300`, `ClientAliveCountMax 2`)<br>• Max authentication attempts capped at 4 (`MaxAuthTries 4`)<br>• **Perimeter Ingress Access Control**: Traefik `ipAllowList` middleware (`admin-ip-allowlist`) isolating administrative dashboards (Headlamp, Longhorn) strictly to trusted RFC 1918 subnets (`192.168.0.0/16`, `10.0.0.0/8`), blocking public WAN probing with 403 Forbidden | `playbooks/03-security-harden.yml`<br>`templates/headlamp.yaml.j2`<br>`templates/longhorn-ingress.yaml.j2` |
| **System & Comm Protection (SC)** | **NIST:** SC-5, SC-7, SC-8, SC-28<br>**SOC 2:** CC6.6, CC6.7<br>**HITRUST:** 08.b, 09.m | • Host-based firewall (UFW) with default deny inbound policy<br>• Inbound access restricted to known management subnets<br>• Kernel ASLR randomization level 2 (`kernel.randomize_va_space = 2`)<br>• SYN flood mitigation (`net.ipv4.tcp_syncookies = 1`)<br>• ICMP redirect acceptance and sending disabled<br>• Reverse path filtering enabled (`rp_filter = 1`) to thwart IP spoofing<br>• Core dumps disabled (`fs.suid_dumpable = 0`)<br>• **HTTP $\rightarrow$ HTTPS Redirection**: Mandatory 308 Permanent Redirection on public routes<br>• **Security Response Headers**: Traefik injection of `Strict-Transport-Security` (1-year preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and restrictive `Permissions-Policy`<br>• **Information Leakage Prevention**: Disabled Express `X-Powered-By` framework banner | `playbooks/03-security-harden.yml`<br>`templates/nodeapp.yaml.j2`<br>`apps/NodeApp/app.js` |
| **Cryptographic Protection (SC/CR)** | **NIST:** SC-12, SC-13, SC-28<br>**SOC 2:** CC6.1, CC6.7<br>**HITRUST:** 10.a, 10.b | • K3s Kubernetes secrets encrypted at rest via AES-CBC / AES-GCM (`--secrets-encryption`)<br>• TLS 1.3 inter-node control plane communications<br>• Cluster join authentication handled via cryptographically random token<br>• **Traefik Ingress TLS Hardening**: Enforced TLS 1.2 minimum version and modern AEAD cipher suites (`AES-128-GCM`, `AES-256-GCM`, `CHACHA20-POLY1305`), rejecting obsolete TLS 1.0 and 1.1 handshakes<br>• **Automated Public PKI**: Automated Let's Encrypt production certificates via cert-manager | `templates/k3s-server-config.yaml.j2`<br>`templates/traefik-tls-options.yaml.j2`<br>`playbooks/05-cert-manager.yml` |
| **Audit & Accountability (AU)** | **NIST:** AU-2, AU-3, AU-8, AU-12<br>**SOC 2:** CC7.2, CC7.3<br>**HITRUST:** 09.aa, 09.ab | • Kubernetes API server audit logging enabled (`--kube-apiserver-arg=audit-log-path=...`)<br>• Custom audit policy recording all Secret, ConfigMap, and RBAC modifications at `RequestResponse` level<br>• Host-level audit logging enabled via Linux `auditd`<br>• NTP / Network time synchronization enforced via `systemd-timesyncd` for verifiable event timestamps | `templates/audit-policy.yaml.j2`<br>`playbooks/03-security-harden.yml` |
| **System & Information Integrity (SI)** | **NIST:** SI-2, SI-4<br>**SOC 2:** CC7.1, CC6.8<br>**HITRUST:** 07.b | • Automated security vulnerability patching via `unattended-upgrades`<br>• Enforced CIS Kubernetes Benchmark kernel protections via K3s `--protect-kernel-defaults` flag | `playbooks/03-security-harden.yml`<br>`templates/k3s-server-config.yaml.j2` |

---

## 2. Kubernetes API Server Audit Logging Policy

The cluster deploys an audit policy configured to capture compliance-critical operations:
* **Secrets & ConfigMaps:** Monitored at `RequestResponse` level to capture authorization changes and configuration tampering without logging credentials in plain text.
* **RBAC Operations:** Roles, RoleBindings, ClusterRoles, and ClusterRoleBindings audited at `RequestResponse` level.
* **Metadata Baseline:** All administrative API interactions recorded at `Metadata` level.
* **Noise Suppression:** High-frequency, unprivileged internal controller watches (e.g. `kube-proxy`, `system:nodes`) excluded to prevent disk exhaustion.

---

## 3. Host Firewall (UFW) Network Segmentation

```text
[LAN: 192.168.1.0/24]
        │
        ├── (Port 22/TCP)    ──> SSH Administration
        ├── (Port 6443/TCP)  ──> K3s API Server / kube-vip
        ├── (Port 80/443/TCP)──> Traefik Ingress (HTTP/HTTPS)
        │
[Internal Node-to-Node Mesh Only]
        │
        ├── (Port 2379-2380) ──> etcd Peer & Client Mesh (kube-1..3 only)
        ├── (Port 8472/UDP)  ──> Flannel VXLAN Overlay Network
        ├── (Port 10250/TCP) ──> Kubelet Node Metrics & Execution
        └── (Port 2112/TCP)  ──> kube-vip Prometheus & Health Metrics
```

Default inbound policy: **DENY**  
Default routed policy: **ALLOW** (required for container CNI cross-pod routing)
