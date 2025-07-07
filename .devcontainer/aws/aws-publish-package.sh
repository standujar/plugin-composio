#!/bin/bash

# Fonction principale pour publier un package
publish_package() {
    # Couleurs pour les logs
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    NC='\033[0m' # No Color

    # Configuration
    S3_BUCKET="kody-plugin"

    # Fonction pour afficher des messages
    function log {
        echo -e "${GREEN}[INFO]${NC} $1"
    }

    function log_warning {
        echo -e "${YELLOW}[WARNING]${NC} $1"
    }

    function log_error {
        echo -e "${RED}[ERROR]${NC} $1"
    }

    # Fonction pour vérifier si une commande existe
    function check_command {
        if ! command -v "$1" &> /dev/null; then
            log_error "La commande '$1' n'est pas installée. Veuillez l'installer et réessayer."
            return 1
        fi
    }

    # Enlever le mode strict d'erreur pour éviter les sorties automatiques

    # Vérifier les prérequis
    check_command "aws" 
    check_command "pnpm" 
    check_command "jq" 

    # Vérifier que nous sommes dans un répertoire avec un package.json
    if [ ! -f "package.json" ]; then
        log_error "Aucun fichier package.json trouvé dans le répertoire courant."
        return 1
    fi

    # Étape 1: Authentification SSO AWS
    log "Authentification SSO AWS en cours..."
    if ! sso-login; then
        log_error "Échec de l'authentification SSO AWS."
        return 1
    fi

    # Vérifier si l'authentification fonctionne
    if ! aws sts get-caller-identity &>/dev/null; then
        log_warning "La vérification SSO a échoué. Essai de renouvellement du SSO..."
        sso-login --profile default
        
        if ! aws sts get-caller-identity &>/dev/null; then
            log_error "L'authentification AWS est toujours défaillante après réessai."
            log_error "Vous devrez peut-être configurer manuellement AWS CLI avec 'aws configure sso'."
            return 1
        fi
    fi

    log "Authentification SSO AWS réussie."

    # Étape 2: Extraire le nom du package
    FULL_PACKAGE_NAME=$(jq -r '.name' package.json)
    if [[ -z "$FULL_PACKAGE_NAME" || "$FULL_PACKAGE_NAME" == "null" ]]; then
        log_error "Impossible d'extraire le nom du package de package.json"
        return 1
    fi

    # Extraire la dernière partie du nom (après le dernier /)
    PACKAGE_NAME=$(echo "$FULL_PACKAGE_NAME" | sed 's/.*\///' | sed 's/@kody-plugin\///')
    if [[ -z "$PACKAGE_NAME" ]]; then
        log_error "Impossible d'extraire le nom court du package depuis '$FULL_PACKAGE_NAME'"
        return 1
    fi

    log "Nom du package extrait: $PACKAGE_NAME"
    S3_PATH="$PACKAGE_NAME"
    log "Chemin S3: $S3_PATH"

    # Étape 3: Builder le package avec pnpm
    log "Construction du package en cours..."
    if ! pnpm run build; then
        log_error "Échec de la construction du package."
        return 1
    fi
    log "Construction du package réussie."

    # Étape 4: Publier le package.json sur S3
    log "Publication du package.json sur S3..."

    # Essayer d'abord avec les informations d'identification actuelles
    if aws s3 cp package.json "s3://$S3_BUCKET/$S3_PATH/package.json"; then
        log "Publication du package.json sur S3 réussie."
    else
        log_warning "Échec de la publication avec les identifiants actuels. Tentative avec authentification alternative..."
        
        # Alternative 1: Essayer avec un profil spécifique si configuré
        if aws s3 cp package.json "s3://$S3_BUCKET/$S3_PATH/package.json" --profile default; then
            log "Publication du package.json sur S3 réussie avec le profil par défaut."
        else
            # Alternative 2: Utiliser AWS Console pour l'upload si tout échoue
            log_error "Impossible de publier le package.json sur S3 via CLI."
            log_error "Veuillez uploader manuellement le package.json vers s3://$S3_BUCKET/$S3_PATH/package.json via la console AWS."
            log_warning "Le script continuera avec la publication du package..."
        fi
    fi

    # Étape 5: Publier le package sur CodeArtifact
    log "Publication du package..."
    if ! pnpm publish --no-git-check; then
        log_error "Échec de la publication du package."
        return 1
    fi

    log "✅ Publication du package terminée avec succès!"
    log "📦 Package: $FULL_PACKAGE_NAME"
    log "🗂️ S3 Path: s3://$S3_BUCKET/$S3_PATH/package.json"
    return 0
}

# Fonction wrapper pour l'alias
package-management() {
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

  print_message "🚀 Lancement de la publication du package..." "${BLUE}"
  
  # Appel de la fonction principale
  publish_package
}