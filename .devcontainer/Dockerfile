ARG NODE_VER=23.5.0
ARG BASE_IMAGE=node:${NODE_VER}
FROM $BASE_IMAGE

ENV DEBIAN_FRONTEND=noninteractive

# Installation des outils de base
RUN apt-get update \
    && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    nano \
    vim \
    curl \
    unzip \
    jq \
    mesa-utils \
    gpg \
    zsh \
    command-not-found \
    apt-transport-https \
    ca-certificates \
    gnupg-agent \
    software-properties-common \
    sudo \
    tree

# Installation de AWS CLI v2 en fonction de l'architecture
RUN if [ "$(uname -m)" = "aarch64" ]; then \
        curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"; \
    else \
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"; \
    fi \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Set Python 3 as the default python
RUN ln -s /usr/bin/python3 /usr/bin/python

# Installation de pnpm
ARG PNPM_VER=10.7.0
RUN npm install -g pnpm@${PNPM_VER}

# # Installation de Bun pour l'utilisateur node
# USER node
# RUN curl -fsSL https://bun.sh/install | bash
# ENV PATH="/home/node/.bun/bin:${PATH}"
# USER root

# Installation de NVM
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Configuration de l'utilisateur node et installation de oh-my-zsh
USER node
WORKDIR /workspace

# Installation de Oh My Zsh et plugins pour l'utilisateur node
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended \
    && git clone https://github.com/zsh-users/zsh-autosuggestions ${HOME}/.oh-my-zsh/custom/plugins/zsh-autosuggestions \
    && git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${HOME}/.oh-my-zsh/custom/plugins/zsh-syntax-highlighting

# Configuration de zsh
COPY --chown=node:node zshrc/.zshrc /home/node/.zshrc

SHELL ["/bin/zsh", "-c"]

ENV DEBIAN_FRONTEND=dialog

# Définir zsh comme shell par défaut pour l'utilisateur node
ENV SHELL=/bin/zsh

ARG AWS_PROD_ACCOUNT_ID
ARG AWS_PREPROD_ACCOUNT_ID
ARG AWS_ROLE_NAME
ARG AWS_SSO_START_URL
ARG AWS_SSO_REGION
ARG CODEARTIFACT_REPOSITORY
ARG CODEARTIFACT_DOMAIN
ARG CODEARTIFACT_TOOL

ENV AWS_PROD_ACCOUNT_ID=${AWS_PROD_ACCOUNT_ID}
ENV AWS_PREPROD_ACCOUNT_ID=${AWS_PREPROD_ACCOUNT_ID}
ENV AWS_ROLE_NAME=${AWS_ROLE_NAME}
ENV AWS_SSO_START_URL=${AWS_SSO_START_URL}
ENV AWS_SSO_REGION=${AWS_SSO_REGION}
ENV CODEARTIFACT_REPOSITORY=${CODEARTIFACT_REPOSITORY}
ENV CODEARTIFACT_DOMAIN=${CODEARTIFACT_DOMAIN}
ENV CODEARTIFACT_TOOL=${CODEARTIFACT_TOOL}

# Copier le script AWS sans l'exécuter (sera exécuté par .zshrc)
COPY --chown=node:node aws/aws-config.sh /home/node/aws-config.sh
# Copier le script CodeArtifact
COPY --chown=node:node aws/aws-sso-codeartifact-login.sh /home/node/aws-sso-codeartifact-login.sh
USER root
RUN chmod +x /home/node/aws-config.sh
RUN chmod +x /home/node/aws-sso-codeartifact-login.sh
USER node 