FROM ghcr.io/infitx-org/ml-e2e-test-runner:v0.0.1
WORKDIR /opt/app

COPY ttk-test-collection /opt/app/ttk-test-collection

CMD ["npm", "run", "start"]
