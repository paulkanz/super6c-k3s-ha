# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **LoRaWAN Gateway Capacity, Airtime & NVMe Storage Sizing Analysis** ([`docs/LORAWAN_CAPACITY_AND_STORAGE_ANALYSIS.md`](LORAWAN_CAPACITY_AND_STORAGE_ANALYSIS.md)):
  - Modeled physical RF airtime constraints, Time on Air (ToA), US915 FCC 400ms dwell time compliance, and uncoordinated Pure ALOHA packet collision probabilities for an 8-channel gateway.
  - Sized data generation, monthly growth, and retention timelines for 115-byte payloads at 5-minute intervals (with optional 15-minute cadence) across 500-sensor (~200 yrs compressed @ 5m / ~600 yrs @ 15m) and 2,000-sensor (~50 yrs compressed @ 5m / ~150 yrs @ 15m) fleets on a 200 GB usable NVMe storage partition.
  - Documented Wi-Fi backhaul utilization (<40 kbps) and multi-gateway spatial scaling architectures.

### Planned
- Automated rolling reboot with Kubernetes node drain/uncordon in maintenance playbooks.
- Integration tests for automated Longhorn backup target (NFS/S3).
- Grafana & Prometheus monitoring stack deployment.

## [0.11.0] - 2026-09-12

### Added
- **NIST SP 800-53, SOC 2, HITRUST & CIS Controls (P1 through P5 Baseline)**:
  - **P1: Host Auditing & Accountability (`auditd` Rules)** (NIST AU-2, AU-3, AU-12 / CIS Linux 4.1):
    - Deployed `/etc/audit/rules.d/99-compliance.rules` across all 6 cluster nodes.
    - Added monitoring for identity changes (`/etc/shadow`, `/etc/passwd`), privilege escalation (`/etc/sudoers`), SSH configuration changes, network configurations (`/etc/hosts`, `/etc/resolv.conf`), kernel module loading/unloading, and unauthorized file access attempts (`openat/openat2` exiting with `-EACCES` or `-EPERM`).
  - **P2: Host Intrusion Defense (`fail2ban`)** (NIST AC-7, SI-4 / SOC 2 CC6.1, CC6.8 / CIS Linux 3.5):
    - Installed and enabled `fail2ban` service across all nodes.
    - Configured SSH jail (`/etc/fail2ban/jail.d/99-k3s-hardening.local`) with 3 max retries, 10-minute observation window, 1-hour ban time, and automatic IP allowlisting for management and pod CIDRs.
  - **P3: Legal System Warning Banners & UMASK Policy** (NIST AC-8, AC-3 / CIS Linux 1.7, 5.4):
    - Deployed legal warning banners to `/etc/issue` and `/etc/issue.net` notifying users that unauthorized access is strictly prohibited and all activity is monitored.
    - Enforced `Banner /etc/issue.net` in `/etc/ssh/sshd_config.d/99-k3s-hardening.conf`.
    - Enforced `UMASK 027` in `/etc/login.defs` restricting world-readable file creation.
  - **P4: Attack Surface & Kernel Module Blacklisting** (NIST CM-7, SC-5 / CIS Linux 1.1, 3.4):
    - Deployed `/etc/modprobe.d/99-compliance-blacklist.conf` disabling insecure protocols (`dccp`, `sctp`, `rds`, `tipc`) and legacy filesystems (`cramfs`, `freevxfs`, `jffs2`, `hfs`, `hfsplus`, `udf`).
  - **P5: Default ServiceAccount Token Disablement** (CIS Kubernetes 5.1.5 / NIST AC-6, SC-28):
    - Enforced `automountServiceAccountToken: false` on `default` ServiceAccounts across all cluster namespaces (`default`, `kube-system`, `kube-public`, `kube-node-lease`, `nodeapp`, `headlamp`).
    - Added declarative ServiceAccount manifests to `templates/nodeapp.yaml.j2` and `templates/headlamp.yaml.j2`.

---

## [0.10.0] - 2026-09-12

### Added
- **Tier 1 Kubernetes Best Practices: Complete Hardening, PSA, HPA v2, and Topology Spread**:
  - **Restricted Pod Security Standard (PSS) Workload Hardening**:
    - Enforced `automountServiceAccountToken: false`, preventing default API token mounts into application pods.
    - Configured container `securityContext` with `allowPrivilegeEscalation: false`, `capabilities: drop: ["ALL"]`, and `readOnlyRootFilesystem: true`.
    - Added ephemeral `emptyDir` mount for `/tmp` preserving scratch functionality under a read-only root filesystem.
    - Set pod-level `seccompProfile: { type: RuntimeDefault }` conforming to CIS Benchmark 5.7.4.
  - **Native Pod Security Admission (PSA) Enforcement**:
    - Declaratively labeled namespace `nodeapp` with `pod-security.kubernetes.io/enforce: restricted`, `audit: restricted`, and `warn: restricted` (`v1.31+`).
    - Validated through live in-cluster tests: unhardened/privileged pods are rejected by the Kubernetes API admission controller.
  - **Horizontal Pod Autoscaler (HPA v2)**:
    - Deployed `autoscaling/v2` `HorizontalPodAutoscaler` (`nodeapp-hpa`) dynamically scaling NodeApp from 2 to 5 replicas.
    - Parameterized target utilization thresholds (`nodeapp_hpa_cpu_target: 70%`, `nodeapp_hpa_memory_target: 80%`) backed by K3s Metrics Server.
  - **Mathematical Topology Spread Constraints**:
    - Replaced legacy heuristic `podAntiAffinity` with `topologySpreadConstraints` (`maxSkew: 1` across `kubernetes.io/hostname`, `whenUnsatisfiable: ScheduleAnyway`).
    - Guarantees even replica distribution across worker nodes (`kube-4`, `kube-5`, `kube-6`) during scale-up and maintenance.
  - **Ansible Automation & Verification**:
    - Updated `playbooks/09-nodeapp.yml` to query and report HPA metrics and namespace PSA enforcement labels in real time.

---

## [0.9.0] - 2026-09-12

### Added
- **Tier 1 Kubernetes Best Practices: High Availability & Zero-Trust Microsegmentation**:
  - **PodDisruptionBudget (`nodeapp-pdb`)**:
    - Implemented `policy/v1` `PodDisruptionBudget` for the `nodeapp` workload with `minAvailable: 1` (`nodeapp_pdb_min_available: 1`).
    - Guarantees voluntary disruptions (node drains, host kernel updates, rolling cluster reboots) will not degrade workload availability below 1 active replica.
  - **Zero-Trust NetworkPolicy (`nodeapp-isolation`)**:
    - Enforced strict default-deny microsegmentation for all ingress and egress in namespace `nodeapp`.
    - **Ingress Isolation**: Allowed inbound TCP port 4300 traffic exclusively from Traefik Ingress Controller pods in `kube-system` and Kubelet health probe sources on the host subnet (`192.168.1.0/24`); all other pod-to-pod and namespace ingress is dropped.
    - **Egress Isolation**: Whitelisted outbound traffic strictly to CoreDNS (`kube-system` / `10.43.0.10:53` UDP/TCP) and dedicated MySQL database host (`192.168.1.150:3306` TCP); all lateral movement to Kubernetes API server (`10.43.0.1:443`) and outbound internet access are dropped.
  - **Automation & Observability in `playbooks/09-nodeapp.yml`**:
    - Added automated reconciliation retry loops verifying PDB and NetworkPolicy availability.
    - Enhanced deployment status summary output to display active PDB disruption limits and NetworkPolicy selectors.
    - Validated through live in-cluster penetration tests (unauthorized namespace ingress blocked, lateral movement egress blocked, MySQL and DNS queries verified functional, VIP ingress returning HTTP/2 200 OK).

---

## [0.8.0] - 2026-09-12

### Added
- **Security Scanner Hardening & IaC Compliance (Checkov, Ansible-Lint, Trivy)**:
  - **Ansible Safety & Pipefail**:
    - Added `set -o pipefail` and explicit `/bin/bash` execution to all piped shell operations in `playbooks/04-k3s-cluster.yml` and `playbooks/06-longhorn.yml`, preventing masked upstream pipe failures.
    - Added descriptive top-level play names across `playbooks/site.yml` and incorporated `playbooks/09-nodeapp.yml`.
    - Achieved a 100% clean pass across all 13 files with **0 failures and 0 warnings** under `ansible-lint --profile safety` (and passed the `production` profile).
  - **Container Security Hardening (Non-Root Execution)**:
    - Updated `apps/NodeApp/Dockerfile` with non-root user `USER node` (UID 1000) and proper directory ownership (`chown -R node:node`), eliminating Trivy's `HIGH` container escape finding.
    - Added in-container `HEALTHCHECK` command utilizing lightweight internal Node HTTP probe.
    - Enforced `securityContext` (`runAsNonRoot: true`, `runAsUser: 1000`, `runAsGroup: 1000`, `fsGroup: 1000`) in `templates/nodeapp.yaml.j2`.
    - Rebuilt `nodeapp:0.2.3` and rolled out to worker nodes, verified runtime `uid=1000(node)`.
  - **Checkov IaC Audit**:
    - Scanned all Ansible playbooks with Checkov, passing 12/12 security compliance checks (package integrity, signature validation, secret masking).

---

## [0.7.0] - 2026-09-12

### Added
- **Automated K3s etcd Snapshot & Disaster Recovery Baseline**:
  - Configured automated etcd backup snapshots across all control plane nodes (`kube-1`, `kube-2`, `kube-3`).
  - Parameterized snapshot frequency (`k3s_etcd_snapshot_schedule_cron: "0 */6 * * *"` — every 6 hours), retention window (`k3s_etcd_snapshot_retention: 28` — 7 days retention), and gzip compression (`k3s_etcd_snapshot_compress: true` — reducing snapshot sizes by ~84% from 15MB to ~2.4MB).
  - Integrated snapshot settings into `templates/k3s-server-config.yaml.j2` and `inventory/group_vars/all/vars.yml`.
  - Added automated rolling restart capability to `playbooks/04-k3s-cluster.yml` preserving continuous etcd quorum and kube-vip availability during server configuration changes.

---

## [0.6.0] - 2026-09-12

### Added
- **ConfigMap & Secret Separation**:
  - Deconstructed monolithic `nodeapp-db-secret` into decoupled Kubernetes primitives:
    - **`ConfigMap` (`nodeapp-config`)**: Injected non-sensitive parameters (`DB_HOST`, `DB_PORT`, `DB_NAME`, `PORT`).
    - **`Secret` (`nodeapp-secret`)**: Injected sensitive credentials (`DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`).
  - **Fail-Fast Startup Validation**:
    - Updated `apps/NodeApp/app.js` with startup verification for mandatory environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`).
    - Completely eradicated in-code plaintext fallback secrets and passwords across the application codebase.
  - **Vault-Backed Credentials**:
    - Centralized `vault_nodeapp_db_user`, `vault_nodeapp_db_password`, and `vault_nodeapp_session_secret` in `inventory/group_vars/all/vault.yml`.
    - Removed fallback defaults in `vars.yml` ensuring deployment fails safely if Ansible Vault is not decrypted.
  - **Container Distribution**:
    - Built `nodeapp:0.2.3` for `linux/arm64` and distributed to worker nodes (`kube-4`, `kube-5`, `kube-6`) via `build-and-import-nodeapp.sh`.
    - Rolled out updated deployment with zero downtime via `playbooks/09-nodeapp.yml`.

---

## [0.5.0] - 2026-09-12

### Added
- **Centralized Variable Management & Secret Parameterization**:
  - Extracted all hardcoded parameters across templates and playbooks into `inventory/group_vars/all/vars.yml` and Ansible Vault `inventory/group_vars/all/vault.yml`.
  - **Perimeter & Ingress Security**:
    - Centralized `traefik_admin_allowlist_cidrs` for Headlamp and Longhorn administrative ingress access control.
    - Centralized Traefik TLS parameters (`traefik_tls_min_version`, `traefik_tls_sni_strict`, `traefik_tls_cipher_suites`).
    - Centralized HTTP security headers (`traefik_hsts_seconds`, `traefik_hsts_include_subdomains`, `traefik_hsts_preload`, `traefik_frame_options`, `traefik_permissions_policy`).
    - Centralized cert-manager ClusterIssuer references (`acme_issuer_prod`, `acme_issuer_staging`).
  - **DDoS Mitigation & Traffic Shaping**:
    - Centralized NodeApp rate limiting (`nodeapp_ratelimit_average`, `nodeapp_ratelimit_period`, `nodeapp_ratelimit_burst`), concurrent connection throttling (`nodeapp_inflight_max`), and request buffering limits (`nodeapp_buffering_max_body_bytes`, `nodeapp_buffering_mem_body_bytes`).
  - **Workload Compute & Memory Limits**:
    - Parameterized container CPU requests/limits and memory requests/limits for `nodeapp` and `headlamp`.
    - Parameterized Longhorn storage percentage threshold and guaranteed CPU allocations (`longhorn_storage_minimal_available_percentage`, `longhorn_guaranteed_instance_manager_cpu`).
  - **Secrets Hygiene & Ansible Vault**:
    - Moved NodeApp session secret and database credentials into `vault.yml` (`vault_nodeapp_session_secret`, `vault_nodeapp_db_password`), eliminating hardcoded fallbacks from template source files.
  - **Host Security Parameterization**:
    - Parameterized SSH daemon hardening options (`ssh_client_alive_interval`, `ssh_client_alive_count_max`, `ssh_max_auth_tries`, `ssh_port`) in `playbooks/03-security-harden.yml`.
    - Updated host firewall `admin_subnets` to include `192.168.1.0/24`, `172.16.0.0/12`, and `10.0.0.0/8` preventing management lockout.

---

## [0.4.0] - 2026-09-12

### Added
- **HTTPS & Ingress Security Hardening**:
  - Enforced automatic HTTP $\rightarrow$ HTTPS redirection (308 Permanent Redirect) on NodeApp ingress.
  - Deployed Traefik cluster-wide `TLSOption` (`templates/traefik-tls-options.yaml.j2`) enforcing TLS 1.2 minimum version and modern AEAD cipher suites (`ECDHE-ECDSA-AES-128-GCM`, `ECDHE-RSA-AES-128-GCM`, `ECDHE-RSA-CHACHA20-POLY1305`, etc.), rejecting legacy TLS 1.0 and 1.1 handshakes.
  - Injected standard security headers across Traefik IngressRoutes: HTTP Strict Transport Security (`HSTS` max-age=31536000; includeSubDomains; preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
  - **DDoS Mitigation & Traffic Shaping**: Deployed Traefik `RateLimit` (token bucket: 100 req/min, burst 30), `InFlightReq` (max 15 concurrent requests per source IP against Slowloris), and `Buffering` (2 MB max body size rejecting payload bombs with HTTP 413) middlewares on `nodeapp-ingress-https`.
- **Administrative UI Perimeter Protection & IP Allowlisting**:
  - Restricted external access to Headlamp (`headlamp.example.com`) and Longhorn (`longhorn.example.com`) management dashboards using Traefik `ipAllowList` middleware (`admin-ip-allowlist`).
  - Permitted access exclusively to trusted private LAN / VPN subnets (`192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`, `127.0.0.1/32`), returning 403 Forbidden to public WAN clients.
- **NodeApp Application Hardening**:
  - Disabled framework fingerprinting header (`X-Powered-By: Express`) in `apps/NodeApp/app.js`.
  - Configured parameterized session secret (`SESSION_SECRET`) managed via Kubernetes Secret (`nodeapp-db-secret`) and hardened cookie attributes (`httpOnly: true, sameSite: 'lax'`).

---

## [0.3.0] - 2026-09-12

### Added
- **cert-manager & Let's Encrypt ACME Integration**:
  - Integrated `cert-manager` v1.16.2 (`playbooks/05-cert-manager.yml`) with automated webhook and CRD readiness validation.
  - Deployed Let's Encrypt HTTP-01 `ClusterIssuer` resources (`letsencrypt-prod` and `letsencrypt-staging`) via `templates/cert-manager-issuers.yaml.j2`.
  - Configured `Certificate` resources for `headlamp.example.com` and `longhorn.example.com` awaiting OpenWrt port forwarding cutover.
- **Frontend Authentication & Security**:
  - **Longhorn UI**: Configured Traefik `basicAuth` middleware (`longhorn-basic-auth`) and encrypted Secret (`longhorn-auth-secret`) for user `kube-admin`.
  - **Ansible Vault Integration**: Created `inventory/group_vars/all/vault.yml` encrypted with password `kube-vault`, storing strong random admin credentials and bcrypt hashes.
  - **Headlamp Native RBAC**: Removed unsafe auto-login flag and enabled native Kubernetes token authentication. Created persistent `headlamp-admin-token` Secret for `cluster-admin` RBAC.
- **Playbook Resequencing & Orchestration**:
  - Resequenced deployment pipeline: `05-cert-manager.yml` $\rightarrow$ `06-longhorn.yml` $\rightarrow$ `07-headlamp.yml` $\rightarrow$ `08-verify.yml`.
  - Updated `playbooks/08-verify.yml` to automatically retrieve and display Headlamp admin tokens, vault credentials, and HTTPS domain endpoints.
- **Documentation**:
  - Added `OPENWRT_ALT_PORT_ROUTING.md` detailing OpenWrt destination NAT port translation (WAN 8443 $\rightarrow$ LAN 443), dual-cluster coexistence with legacy gateways, and ACME challenge handling.
  - Added `CLUSTER_HARDWARE_STACK_ANALYSIS.md` detailing single-chassis 6-node DeskPi Super6C multi-node topology, multi-tier workload capacity and memory budgeting (IoT, Web, SSO, lightweight microservices), full infrastructure power budget (compute + WAN ONT/Gateway + OpenWrt router), 100% off-grid solar PV and 12V 200Ah LiFePO4 battery sizing (2,560Wh / multi-day autonomy), native DC power delivery, and automated low-voltage graceful shutdown.
  - Added `IOT_LORAWAN_STACK_ARCHITECTURE.md` detailing LoRaWAN, MQTT, ChirpStack v4, ThingsBoard CE, TTN, Node-RED, TimescaleDB, and Grafana deployment architectures, memory footprints, protocol ingress (WSS vs UDP), 200-tenant / 4,000-sensor scalability calculations, AWS cloud footprint & financial ROI ($820–$1,380/mo AWS vs $6.50/mo on-premises edge), and Internet bandwidth requirements.
  - Added `scripts/copy-headlamp-token.sh` helper utility leveraging `pbcopy` to extract the decoded Headlamp admin RBAC Bearer token directly into the macOS clipboard buffer.
  - Updated `README.md` with DeskPi Super6C Mini-ITX slot mapping (Slots 1–6) and backplane switch networking details.
- **NodeApp Sensor Dashboard Migration to K3s**:
  - Parameterized `apps/NodeApp/app.js` to support dynamic environment variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) with backward-compatible defaults.
  - Created `templates/nodeapp.yaml.j2` defining the `nodeapp` Namespace, Secret, Deployment with anti-affinity across worker nodes, ClusterIP Service, Traefik IngressRoute, and cert-manager Certificate.
  - Added automated build & distribution script `scripts/build-and-import-nodeapp.sh` streaming ARM64 images directly into worker containerd runtimes without requiring an external container registry.
  - Created `playbooks/09-nodeapp.yml` for automated deployment and health verification.

---

## [0.2.0] - 2026-09-12

### Added
- **Headlamp Cluster-Wide Web Dashboard**:
  - Deployed Headlamp Kubernetes web UI (`ghcr.io/headlamp-k8s/headlamp:latest`) providing visual management for pods, deployments, services, nodes, Helm releases, CRDs, and logs.
  - Pre-authenticated via in-cluster `headlamp-admin` ServiceAccount bound to `cluster-admin`.
  - Configured Traefik `IngressRoute` with permanent redirect middleware (`headlamp-redirect`) handling both `http://192.168.1.130/headlamp` and trailing-slash access cleanly.
  - Added dedicated LoadBalancer service exposing Headlamp on port 8081 (`http://192.168.1.130:8081/headlamp/`).
  - Automated deployment via `templates/headlamp.yaml.j2` and `playbooks/06-headlamp.yml`.
  - Renamed verification playbook to `playbooks/07-verify.yml` and updated `playbooks/site.yml`.
- **Longhorn UI Automation & Verification**:
  - Added `longhorn_ui_port: 8080` configuration variable to `inventory/group_vars/all.yml`.
  - Parameterized `templates/longhorn-ingress.yaml.j2` LoadBalancer service port and Traefik redirect target.
  - Added automated rollout readiness verification for `deployment/longhorn-ui` in `playbooks/05-longhorn.yml`.

### Fixed
- **Longhorn UI Subpath Routing**: Configured dedicated Klipper LoadBalancer on port 8080 (`http://192.168.1.130:8080`) with Traefik regex redirect from `/longhorn` to avoid SPA root path routing limitations.

---

## [0.1.0] - 2026-09-11

### Fixed
- **CIS Benchmark Kernel Validation**: Added `kernel.panic = 10` and `kernel.panic_on_oops = 1` to host sysctl configurations (`playbooks/01-bootstrap.yml` and `playbooks/03-security-harden.yml`) to satisfy Kubelet's `--protect-kernel-defaults` validation on Debian 12 / RPi OS.
- **Node Readiness Retries**: Increased cluster readiness check timeout to 300s to allow adequate time for etcd quorum formation and image pulls.

### Added
- **Ansible Configuration**: Project-level `ansible.cfg` with SSH pipelining, ControlMaster multiplexing, host key checking bypass, and timer callbacks.
- **Inventory & Topology**: Defined 6-node cluster inventory in `inventory/hosts.yml` (3 Server nodes: `kube-1`..`3`, 3 Agent worker nodes: `kube-4`..`6`).
- **High Availability Virtual IP**: Integrated `kube-vip` (Layer 2 ARP) providing a resilient control plane floating virtual IP at `192.168.1.130:6443`.
- **Modular Playbooks**:
  - `playbooks/00-ping.yml`: Connectivity & passwordless sudo verification across all 6 nodes.
  - `playbooks/01-bootstrap.yml`: CM4 hardware/OS bootstrapping (cgroups in `/boot/firmware/cmdline.txt`, permanent swap disablement, NVMe `noatime`, Longhorn prerequisites `open-iscsi`/`nfs-common`, legacy container network interface cleanup).
  - `playbooks/02-patch.yml`: Rolling OS package upgrades via `apt` with sequential reboot handling.
  - `playbooks/03-security-harden.yml`: Security hardening baseline aligned with NIST SP 800-53, SOC 2 Type II, and HITRUST.
  - `playbooks/04-k3s-cluster.yml`: High-availability K3s cluster deployment (kube-vip static pod manifest, primary server init, secondary etcd join, and worker agent join).
  - `playbooks/05-longhorn.yml`: Longhorn distributed block storage deployment with 3-way NVMe replication and automated Traefik Ingress exposure on `/longhorn`.
  - `playbooks/06-verify.yml`: Cluster validation, health check, and automated kubeconfig export to `~/.kube/config-super6c-edge`.
  - `playbooks/site.yml`: Master orchestration playbook running all deployment stages sequentially.
  - `playbooks/reset.yml`: Full cluster teardown, CNI interface cleanup, and uninstallation playbook.
- **Security & Compliance Controls**:
  - SSH daemon hardening (key-only authentication, root login disabled, idle timeout, brute-force attempt limits).
  - Host firewall (UFW) restricting K3s, etcd, and internal metrics traffic to the cluster subnet (`192.168.1.0/24`).
  - Kernel hardening via sysctl (ASLR randomization level 2, SYN cookies, reverse path filtering, disabled redirects).
  - API server audit logging policy (`templates/audit-policy.yaml.j2`).
  - K3s CIS benchmark mode (`--protect-kernel-defaults`) and secrets encryption at rest (`--secrets-encryption`).
  - Host event auditing (`auditd`), NTP time sync (`systemd-timesyncd`), and automated patching (`unattended-upgrades`).
- **Documentation**:
  - `README.md`: Architecture diagrams, hardware specifications, topology tables, step-by-step execution instructions, and edge failover and resilience test scenarios.
  - `COMPLIANCE.md`: Framework crosswalk mapping implemented controls to NIST SP 800-53 Rev 5, SOC 2 Type II, and HITRUST CSF.
  - `AWS_HYBRID_ANALYSIS.md`: Architectural feasibility and pricing analysis for Amazon EKS Anywhere vs. Amazon ECS Anywhere on RPi CM4 hardware.
