#!/bin/bash

# Charger le script codeartifact-login
codeartifact-login() {
    # Utilisation des variables d'environnement du devcontainer.json sans valeurs par défaut
    REPOSITORY=$CODEARTIFACT_REPOSITORY
    DOMAIN=$CODEARTIFACT_DOMAIN
    DOMAIN_OWNER=$AWS_PREPROD_ACCOUNT_ID
    REGION=$AWS_SSO_REGION
    TOOL=$CODEARTIFACT_TOOL

    # Afficher les informations de connexion
    echo "🔑 Connexion à AWS CodeArtifact..."
    echo "Repository: $REPOSITORY"
    echo "Domain: $DOMAIN"

    # Obtenir le token et configurer l'outil
    aws codeartifact login \
    --tool $TOOL \
    --repository $REPOSITORY \
    --domain $DOMAIN \
    --domain-owner $DOMAIN_OWNER \
    --region $REGION
}

sso-codeartifact-login() {
  # Couleurs pour les messages
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  RED='\033[0;31m'
  NC='\033[0m' # No Color

# Fonction pour afficher un message avec une couleur
print_message() {
  echo -e "${2}${1}${NC}"
}

aws sso login

codeartifact-login
}