# 🧠 OSCAR Hub

Welcome to **OSCAR Hub**, a repository of ready-to-deploy services for the [OSCAR](https://github.com/grycap/oscar) platform. Each service is defined using the [**RO-Crate**](https://www.researchobject.org/ro-crate/) standard, including structured metadata, deployment scripts, and FDL definitions.

---

## 🚀 What's in this repository?

- 📂 A collection of directories, each representing a deployable OSCAR service.
- 📄 Inside each directory:
  - `ro-crate-metadata.json`: Service description using the RO-Crate format.
  - `file.yml`: Service definition using the [Functions Definition Language (FDL)](https://docs.oscar.grycap.net/fdl/).
  - `script.sh`: Script to be executed upon service invocation.
---


## 📋 Available Services

| Service | Description | Min RAM | Min CPU |
|---------|-------------|---------|---------|
| `yolov8` | Image recognition service using YoloV8. | 4 GiB | 2 vCPU |
---


## 📦 Adding a New Service

1. Create a new directory named after your service.
2. Add the following required files:
   - `ro-crate-metadata.json`
   - `fdl.yml`
   - `script.sh`
3. Validate your RO-Crate before submitting a pull request.
---


## 🧰 Metadata validation

To validate the services defined via RO-Crate:

```bash
pip install rocrate-validator
```

Then run:

```bash
rocrate-validator validate -p ro-crate-1.1 --verbose --no-paging ./<service>
```
A GitHub action has been configured to automatically validate new entries submitted via PRs.

---

## 📄 License

Each service can define its own license. Make sure to include it in the RO-Crate metadata when applicable.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or a pull request to suggest improvements or add new services.

---

📬 Contact: [GRyCAP](https://www.grycap.upv.es/) - Universitat Politècnica de València
