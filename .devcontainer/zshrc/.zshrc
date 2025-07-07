# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Theme
ZSH_THEME="robbyrussell"

# Plugins
plugins=(
  git
  node
  npm
  zsh-autosuggestions
  zsh-syntax-highlighting
  command-not-found
  aws
)

source $ZSH/oh-my-zsh.sh

# User configuration
export PATH=$HOME/bin:/usr/local/bin:$PATH

# Amélioration de l'autocomplétion
autoload -U compinit && compinit
zstyle ':completion:*' menu select
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' # Case insensitive completion
zstyle ':completion:*' special-dirs true
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
setopt COMPLETE_ALIASES

# Historique amélioré
HISTSIZE=10000
SAVEHIST=10000
setopt SHARE_HISTORY
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_FIND_NO_DUPS

# AWS Aliases et configuration
alias kody-prod="export AWS_DEFAULT_PROFILE=prod"
alias kody-pre-prod="export AWS_DEFAULT_PROFILE=pre-prod"
export AWS_DEFAULT_PROFILE="pre-prod"

# Charger les variables d'environnement depuis .env
if [ -f ".devcontainer/.env" ]; then
  source ".devcontainer/.env"
fi

# Mettre à jour la configuration AWS
if [ -f ".devcontainer/aws/aws-config.sh" ]; then
  bash ".devcontainer/aws/aws-config.sh"
fi

# Charger le script de connexion à CodeArtifact
if [ -f ".devcontainer/aws/aws-sso-codeartifact-login.sh" ]; then
  source ".devcontainer/aws/aws-sso-codeartifact-login.sh"
fi

# Autres Aliases
alias ll='ls -lah'
alias zshconfig="nano ~/.zshrc"
alias reload="source ~/.zshrc"
alias sso-login="sso-codeartifact-login"
alias publish-package="package-management"

# Charger le script de publication de package
if [ -f ".devcontainer/aws/aws-publish-package.sh" ]; then
  source ".devcontainer/aws/aws-publish-package.sh"
fi

# Node Version Manager
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"