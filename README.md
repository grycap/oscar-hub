# 🧠 OSCAR Hub

Welcome to **OSCAR Hub**, a repository of ready-to-deploy services for the [OSCAR](https://github.com/grycap/oscar) platform. Each service is defined using the [**RO-Crate**](https://www.researchobject.org/ro-crate/) standard, including structured metadata, deployment scripts, and FDL definitions.

---

## 🚀 What's in this repository?

- 📂 Inside the `crates`folder, a collection of directories, each representing a deployable OSCAR service.
- 📄 Inside each directory:
  - `ro-crate-metadata.json`: Service description using the RO-Crate format.
  - `fdl.yml`: Service definition using the [Functions Definition Language (FDL)](https://docs.oscar.grycap.net/fdl/).
  - `script.sh`: Script to be executed upon service invocation.
---



## 📦 Adding a New Service

1. Create a new directory named after your service.
2. Copy the contents of `crates/template` into the new directory and adjust the placeholders.
3. Ensure the directory includes:
   - `ro-crate-metadata.json`
   - `fdl.yml`
   - `script.sh`
4. Validate your RO-Crate before submitting a pull request.
---


## 🧰 Metadata validation

To validate the services defined via RO-Crate:

```bash
pip install roc-validator
```

Then run:

```bash
rocrate-validator validate -p ro-crate-1.1 --verbose --no-paging ./<service>
```
A GitHub action has been configured to automatically validate new entries submitted via PRs.

---

## 🏗️ Local development

1. Install dependencies:

   ```bash
   npm install
   ```

   If you plan to work on the documentation site, also run `npm install` inside `docs/`.

2. Start the development server:

   ```bash
   npm run dev
   ```

   The script builds the site, serves the `dist` output, and watches for changes. By default it listens on [http://localhost:4173](http://localhost:4173); set the `PORT` environment variable to use a different port.

3. Edit the contributor & RO-Crate documentation under `docs/` with:

   ```bash
   npm run docs:dev
   ```

   The documentation is built with [Astro Starlight](https://starlight.astro.build) and published under [`/guide`](https://hub.oscar.grycap.net/guide/).

To produce a static bundle without the dev server, run `npm run build` to regenerate `dist/`. This command now builds both the catalog landing page and the `/guide` documentation bundle.

---

## 📚 Guide

The canonical reference for onboarding, workflow expectations, and field-by-field RO-Crate documentation now lives inside this repository at [`docs/`](docs/). It is published together with the catalog at `https://hub.oscar.grycap.net/guide/` and includes:

- Contributor prerequisites and local setup instructions.
- Branching and review workflow checklists.
- Detailed explanations for each RO-Crate section we rely on, with examples pulled from the in-repo services.
- Validation tips, troubleshooting tables, and templates.

---

## 📄 License

Each service can define its own license. Make sure to include it in the RO-Crate metadata when applicable.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or a pull request to suggest improvements or add new services.

---

📬 Contact: [GRyCAP](https://www.grycap.upv.es/) - Universitat Politècnica de València
