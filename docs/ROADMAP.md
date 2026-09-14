# Future Enhancements & Architectural Roadmap

This document serves as the canonical tracking registry for upcoming features, security compliance controls, operational enhancements, and infrastructure expansions for the High Availability K3s cluster.

---

## 1. Tracking Methodology & Status Taxonomy

Each roadmap item is tracked with standardized metadata to facilitate prioritization, planning, and compliance auditing:

* **Status Definitions**:
  * `Backlog`: Identified requirement; pending detailed architectural evaluation or scheduling.
  * `Planned`: Scoped and accepted for upcoming implementation cycle.
  * `In Progress`: Active development or testing currently underway.
  * `Completed`: Implemented, empirically verified against live nodes, documented, and merged.
  * `Deferred`: Postponed due to external dependencies or alternative architectural decisions.
* **Priority Levels**:
  * `P0 (Critical)`: Essential for cluster stability, data loss prevention, or foundational security.
  * `P1 (High)`: Key compliance control (NIST 800-53, SOC 2, CIS) or core reliability enhancement.
  * `P2 (Medium)`: Operational automation, observability improvement, or developer experience.
  * `P3 (Low)`: Non-blocking optimization, exploratory technology, or long-term evolution.

---

## 2. Master Enhancement Registry

| Item ID | Title | Domain | Priority | Target Milestone | Status | Framework / Standard |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **ITEM-001** | [Offsite DR Replication (P6)](#item-001-offsite-disaster-recovery-etcd-snapshot-replication-p6) | Disaster Recovery | **P1** | `v0.12.0` | `Planned` | NIST CP-9, SOC 2 A1.2, HITRUST 09.c |
| **ITEM-002** | [Rolling Node Maintenance Playbook](#item-002-automated-rolling-node-maintenance-playbook) | Operations | **P1** | `v0.12.0` | `Planned` | SRE Reliability, Zero-Downtime |
| **ITEM-003** | [Automated CIS Benchmark Scanning (`kube-bench`)](#item-003-automated-in-cluster-cis-benchmark-scanning-kube-bench) | Compliance / Sec | **P1** | `v0.13.0` | `Planned` | CIS Kubernetes Benchmark v1.8+ |
| **ITEM-004** | [Centralized Audit Log Aggregation (SIEM)](#item-004-centralized-host--kubernetes-audit-log-aggregation) | Audit & Logging | **P2** | `v0.13.0` | `Backlog` | NIST AU-9, AU-12, SOC 2 CC7.2 |
| **ITEM-005** | [Runtime Threat Detection & eBPF Security](#item-005-runtime-threat-detection--file-integrity-monitoring-ebpf) | Intrusion Defense | **P2** | `v0.14.0` | `Backlog` | NIST SI-7, SOC 2 CC6.8, CIS Linux 1.4 |
| **ITEM-006** | [Automated Pre-Commit Security & IaC Linter](#item-006-automated-pre-commit-security--iac-linter-hooks) | DevSecOps | **P2** | `v0.12.0` | `Backlog` | NIST RA-5, SOC 2 CC7.1 |
| **ITEM-007** | [External Secrets Operator (ESO) Integration](#item-007-external-secrets-operator-eso-integration) | Secret Mgmt | **P2** | `v0.14.0` | `Backlog` | NIST SC-28, SOC 2 CC6.1 |
| **ITEM-008** | [Lightweight Cluster Observability & Metrics](#item-008-lightweight-cluster-observability--thermal-telemetry) | Observability | **P2** | `v0.13.0` | `Backlog` | SRE Observability |
| **ITEM-009** | [Disaster Recovery Snapshot Restore Validation](#item-009-automated-etcd-snapshot-restore-validation-drill) | Disaster Recovery | **P1** | `v0.13.0` | `Backlog` | NIST CP-10, SOC 2 A1.3 |
| **ITEM-011** | [Phase 2 — Single-Tenant IoT & Telemetry Platform (ChirpStack & ThingsBoard)](#item-011-phase-2--single-tenant-iot--lorawan-telemetry-platform) | Application / IoT | **P2** | `Phase 2` | `Planned` | SDD Architecture §8.2 |
| **ITEM-012** | [Phase 3 — Upstream Origin Shielding (Cloudflare Anycast)](#item-012-phase-3--upstream-origin-shielding-cloudflare-anycast) | Network Defense | **P3** | `Phase 3` | `Backlog` | SDD Architecture §8.3, DDoS Defense |

---

## 3. Detailed Specifications & Implementation Plans

### ITEM-001: Offsite Disaster Recovery etcd Snapshot Replication (P6)
* **Target Milestone**: `v0.12.0`
* **Priority**: **P1 (High)**
* **Compliance Mapping**: NIST SP 800-53 Rev. 5 CP-9 (Information System Backup), SOC 2 Type II A1.2 (Environmental & Disaster Recovery), HITRUST CSF 09.c.
* **Objective**: Protect cluster state against chassis-level hardware loss (e.g. single ATX PSU failure, backplane fault on DeskPi Super6C) by synchronizing embedded etcd snapshots off-chassis.
* **Technical Scope**:
  1. Leverage native K3s automated snapshot engine (`/var/lib/rancher/k3s/server/db/snapshots/`).
  2. Implement an Ansible task or dedicated cron/systemd service on `kube-1..3` to securely replicate new snapshots to the TrueNAS storage array (`192.168.1.150`) over NFS or SSH/rsync using a dedicated backup key.
  3. Support alternative S3-compatible replication targets (e.g., AWS S3, MinIO, Cloudflare R2) using K3s native `--etcd-s3` options.
  4. Enforce 14-day retention pruning on the offsite target.
* **Acceptance Standard**:
  * Newly generated `.zip` etcd snapshots on `kube-1` are copied to `/mnt/storage/backups/k3s-etcd/` on `192.168.1.150` within 15 minutes of creation.
  * Offsite storage directory contains validated, non-empty snapshot files with restricted permissions (`0600`).

---

### ITEM-002: Automated Rolling Node Maintenance Playbook
* **Target Milestone**: `v0.12.0`
* **Priority**: **P1 (High)**
* **Objective**: Safely execute OS-level updates, firmware patches, or kernel upgrades across all 6 nodes without service interruption or dropping Ingress connections.
* **Technical Scope**:
  1. Create `playbooks/maintenance-reboot.yml` executing sequentially (`serial: 1`).
  2. **Step 1 (Pre-flight)**: Check cluster health (`kubectl get nodes`, Longhorn volume sync status, PodDisruptionBudget state).
  3. **Step 2 (Cordon)**: Mark node unschedulable (`kubectl cordon <node>`).
  4. **Step 3 (Drain)**: Safely evict workloads (`kubectl drain <node> --ignore-daemonsets --delete-emptydir-data --timeout=120s`). Verify `nodeapp-pdb` allows eviction without violating `minAvailable: 1`.
  5. **Step 4 (Reboot)**: Reboot node via Ansible `reboot` module.
  6. **Step 5 (Wait & Verify)**: Wait for SSH accessibility, wait for Kubelet `Ready` status (`kubectl wait --for=condition=Ready node/<node> --timeout=180s`), wait for Longhorn volume replicas to re-sync.
  7. **Step 6 (Uncordon)**: Mark node schedulable (`kubectl uncordon <node>`).
* **Acceptance Standard**:
  * Zero dropped HTTP requests during rolling execution against `https://nodeapp.192.168.1.130.sslip.io/nodeapp/temp`.
  * Playbook executes cleanly on both server nodes (`kube-1..3`) and worker nodes (`kube-4..6`).

---

### ITEM-003: Automated In-Cluster CIS Benchmark Scanning (`kube-bench`)
* **Target Milestone**: `v0.13.0`
* **Priority**: **P1 (High)**
* **Compliance Mapping**: CIS Kubernetes Benchmark v1.8+, NIST CM-6 (Configuration Settings).
* **Objective**: Automate continuous verification of cluster components against CIS Kubernetes Benchmark standards.
* **Technical Scope**:
  1. Create a Kubernetes `CronJob` deploying Aqua Security's `kube-bench` ARM64 container once weekly.
  2. Mount relevant host paths (`/etc/systemd`, `/var/lib/rancher/k3s`, `/etc/rancher/k3s`) as read-only volumes.
  3. Output structured JSON / JUnit test results to a persistent volume or export metrics via Prometheus textfile collector.
  4. Add an ad-hoc execution script in `scripts/run-cis-scan.sh` for developer verification.
* **Acceptance Standard**:
  * Scan job completes with exit code 0 across both control plane and worker node profiles.
  * Compliance score report generated detailing passed, warned, and failed recommendations.

---

### ITEM-004: Centralized Host & Kubernetes Audit Log Aggregation
* **Target Milestone**: `v0.13.0`
* **Priority**: **P2 (Medium)**
* **Compliance Mapping**: NIST AU-9 (Protection of Audit Information), NIST AU-12 (Audit Generation), SOC 2 CC7.2.
* **Objective**: Ship Linux `auditd` events, systemd journal logs, and Kubernetes API audit logs off-node to prevent an attacker with host compromise from destroying forensic history.
* **Technical Scope**:
  1. Deploy a lightweight log shipper (Fluent Bit or Vector) as a DaemonSet or systemd agent with low memory footprint (<50MB RAM per node).
  2. Ingest `/var/log/audit/audit.log` (P1 compliance rules), `/var/lib/rancher/k3s/server/logs/audit.log`, and `journald`.
  3. Stream logs via TLS to external syslog server, Grafana Loki, or external SIEM.
* **Acceptance Standard**:
  * Host `auditd` events (e.g. modification of `/etc/shadow` or `sudoers`) arrive at centralized destination within 5 seconds.

---

### ITEM-005: Runtime Threat Detection & File Integrity Monitoring (eBPF)
* **Target Milestone**: `v0.14.0`
* **Priority**: **P2 (Medium)**
* **Compliance Mapping**: NIST SI-7 (Software, Firmware, and Information Integrity), SOC 2 CC6.8, CIS Linux 1.4.
* **Objective**: Monitor container runtime behavior and file integrity for anomalous activities (e.g. unauthorized shells spawned in production pods, sensitive file modifications).
* **Technical Scope**:
  1. Evaluate lightweight eBPF probe instrumentation on Debian 12 ARM64 kernel (`6.1.x`).
  2. Deploy baseline detection rules:
     * Shell execution inside container (`terminal_shell_in_container`).
     * Write below `/etc` or sensitive binary directories.
     * Unexpected outbound connection from unprivileged pods.
* **Acceptance Standard**:
  * Spawning a shell in `nodeapp` (`kubectl exec -it ... /bin/sh`) generates an alert event within 2 seconds.

---

### ITEM-006: Automated Pre-Commit Security & IaC Linter Hooks
* **Target Milestone**: `v0.12.0`
* **Priority**: **P2 (Medium)**
* **Compliance Mapping**: NIST RA-5 (Vulnerability Monitoring and Scanning), SOC 2 CC7.1.
* **Objective**: Prevent unencrypted secrets, lint failures, or insecure container configurations from being committed to git.
* **Technical Scope**:
  1. Configure `.pre-commit-config.yaml` including:
     * `ansible-lint --profile safety`
     * `checkov` for Kubernetes manifests and Ansible playbooks
     * `trivy` config scanning for Dockerfile and templates
     * `git-secrets` / detect-secrets to prevent plaintext AWS or API keys
* **Acceptance Standard**:
  * Committing an insecure manifest (e.g. `privileged: true` or plaintext secret) is automatically rejected by pre-commit hook.

---

### ITEM-007: External Secrets Operator (ESO) Integration
* **Target Milestone**: `v0.14.0`
* **Priority**: **P2 (Medium)**
* **Compliance Mapping**: NIST SC-28 (Protection of Information at Rest), SOC 2 CC6.1.
* **Objective**: Eliminate static secret generation in Ansible Vault and decouple application secrets into an external credential provider.
* **Technical Scope**:
  1. Deploy External Secrets Operator via Helm.
  2. Integrate with HashiCorp Vault, AWS Secrets Manager, or 1Password Connect server.
  3. Synchronize `DB_PASSWORD` and `SESSION_SECRET` dynamically into `nodeapp-secret`.
* **Acceptance Standard**:
  * Rotating a secret in upstream vault updates the in-cluster Kubernetes Secret without manual Ansible playbook runs.

---

### ITEM-008: Lightweight Cluster Observability & Thermal Telemetry
* **Target Milestone**: `v0.13.0`
* **Priority**: **P2 (Medium)**
* **Objective**: Real-time visibility into CM4 SoC thermals, throttling state, NVMe I/O latency, and Kubernetes pod performance.
* **Technical Scope**:
  1. Deploy VictoriaMetrics (or Prometheus Agent) for minimal CPU/memory footprint on 4GB CM4 nodes.
  2. Deploy `node-exporter` with textfile collector reading `/sys/class/thermal/thermal_zone0/temp` and `vcgencmd get_throttled`.
  3. Provide pre-built Grafana dashboard showing:
     * Individual CM4 compute module temperatures (alerting at >75°C).
     * NVMe wear level and I/O utilization.
     * Ingress rate limiting rejection rates (429 HTTP status).
* **Acceptance Standard**:
  * Dashboard renders real-time thermals across all 6 compute modules with <3% CPU overhead per node.

---

### ITEM-009: Automated etcd Snapshot Restore Validation Drill
* **Target Milestone**: `v0.13.0`
* **Priority**: **P1 (High)**
* **Compliance Mapping**: NIST CP-10 (Information System Recovery and Reconstitution), SOC 2 A1.3.
* **Objective**: Prove recoverability of K3s etcd cluster from automated snapshots without endangering live production state.
* **Technical Scope**:
  1. Create automated test harness (`scripts/verify-etcd-restore-sandbox.sh`).
  2. Spin up a localized test instance or VM sandbox, apply a production snapshot, and verify data integrity (Secrets, CRDs, Namespaces, Deployments).
  3. Document recovery time objective (RTO) and recovery point objective (RPO) metrics.
* **Acceptance Standard**:
  * Automated recovery script restores a cluster from snapshot in <5 minutes with 100% resource fidelity.

---

### ITEM-010: Automated Certificate Expiration Monitoring & Alerting
* **Target Milestone**: `v0.14.0`
* **Priority**: **P3 (Low)**
* **Compliance Mapping**: NIST SC-12 (Cryptographic Key Establishment and Management).
* **Objective**: Proactively alert on cert-manager Let's Encrypt renewal delays or failures before certificate expiration.
* **Technical Scope**:
  1. Expose cert-manager Prometheus metrics (`certmanager_certificate_expiration_timestamp_seconds`).
  2. Trigger alerting webhook if certificate remaining validity drops below 15 days.
* **Acceptance Standard**:
  * Alert fires if test certificate has expiration within renewal warning window.

---

### ITEM-011: Phase 2 — Single-Tenant IoT & Telemetry Platform (ChirpStack & ThingsBoard)
* **Target Milestone**: `Phase 2`
* **Priority**: **P2 (Medium)**
* **Reference**: [`docs/IOT_LORAWAN_STACK_ARCHITECTURE.md`](IOT_LORAWAN_STACK_ARCHITECTURE.md), [`docs/SDD.md`](SDD.md) §8.2.
* **Objective**: Production telemetry ingestion supporting commercial agricultural scale (up to 4,000 active LoRaWAN sensor nodes across vineyard management blocks) hosted directly on the 6-node Super6C cluster.
* **Technical Scope**:
  1. Deploy ChirpStack v4 Network & Application Server with Traefik Basic Station WSS ingress.
  2. Deploy Eclipse Mosquitto or EMQX MQTT Broker cluster with Klipper LoadBalancer on VIP (`192.168.1.130:1883`).
  3. Deploy ThingsBoard Community Edition with strict JVM heap capping (`-Xms1024m -Xmx1792m`) and externalized database.
  4. Deploy PostgreSQL 16 + TimescaleDB with ARM64 optimizations (`jit=off`, `shared_buffers=384MB`, `synchronous_commit=off`) backed by Local NVMe Persistent Volumes and continuous aggregate rollups.
  5. Implement micro-batch ingestion (200–500 rows/insert) via Node-RED / NATS JetStream to minimize storage `fsync` overhead.
* **Acceptance Standard**:
  * 1,000 concurrent MQTT telemetry packets/sec processed with <50ms p99 ingestion latency; 30-day aggregate dashboard queries return in <100ms with zero container OOM kills.

---

### ITEM-012: Phase 3 — Upstream Origin Shielding (Cloudflare Anycast)
* **Target Milestone**: `Phase 3`
* **Priority**: **P3 (Low)**
* **Reference**: [`docs/SDD.md`](SDD.md) §8.3, [`docs/OPENWRT_ALT_PORT_ROUTING.md`](OPENWRT_ALT_PORT_ROUTING.md).
* **Objective**: Protect remote edge site WAN uplink from multi-gigabit Layer 3/4 volumetric DDoS attacks.
* **Technical Scope**:
  1. Transition public DNS to Cloudflare Proxied ("Orange Cloud").
  2. Restrict Traefik ingress on OpenWrt / UFW exclusively to Cloudflare published IP ranges.
  3. Configure Authenticated Origin Pulls (mTLS) between Cloudflare edge and Traefik.
* **Acceptance Standard**:
  * Direct connections to residential WAN IP bypass Cloudflare are dropped with TCP reset / timeout; valid traffic routed through Cloudflare proxy with TLS mutual verification.

---

## 4. Historical Milestones Completed

| Version | Commit | Completion Date | Key Features & Controls Delivered |
| :--- | :---: | :---: | :--- |
| **`v0.11.0`** | `f6d39a6` | 2026-09-12 | NIST/SOC 2/CIS Controls P1–P5: Auditd 99-compliance rules, fail2ban SSH intrusion defense, legal warning banner, UMASK 027, kernel module blacklisting, default ServiceAccount token isolation. |
| **`v0.10.0`** | `907982e` | 2026-09-12 | Pod Security Standards (Restricted PSS), native Pod Security Admission (PSA) enforcement, Horizontal Pod Autoscaler (HPA v2), mathematical Topology Spread Constraints (`maxSkew: 1`). |
| **`v0.9.0`** | `d609e3d` | 2026-09-12 | Zero-trust NetworkPolicy microsegmentation (default deny ingress/egress, CoreDNS/MySQL whitelist), PodDisruptionBudget (`minAvailable: 1`). |
| **`v0.8.0`** | `b2658a8` | 2026-09-12 | ConfigMap & Secret separation (Vault encrypted), non-root container execution (`USER node`), automated compressed etcd snapshots, full IaC security verification (`checkov`, `ansible-lint`). |
| **`v0.7.0`** | `e4785ca` | 2026-09-11 | NodeApp production deployment with Traefik rate limiting, in-flight request capping, buffer limits, and security response headers. |
| **`v0.6.0`** | `65c829e` | 2026-09-11 | Headlamp web UI deployment with native RBAC tokens and domain TLS ingress. |
| **`v0.5.0`** | `108cbb9` | 2026-09-11 | Longhorn v1.7.2 distributed block storage with 3-way NVMe replication. |
| **`v0.4.0`** | `a1b2c3d` | 2026-09-11 | cert-manager v1.16.2 with Let's Encrypt Staging and Production ClusterIssuers. |
| **`v0.3.0`** | `b3c4d5e` | 2026-09-11 | High Availability K3s cluster with embedded etcd and `kube-vip` Layer 2 ARP Virtual IP (`192.168.1.130`). |
| **`v0.2.0`** | `c4d5e6f` | 2026-09-10 | Host baseline security hardening: UFW default-deny firewall, SSH key-only auth, sysctl kernel network protections, timesyncd, unattended-upgrades. |
| **`v0.1.0`** | `d5e6f7a` | 2026-09-10 | Hardware bootstrap for 6x Raspberry Pi CM4 on DeskPi Super6C (cgroups, swapoff, NVMe tuning, legacy Docker interface cleanup). |
