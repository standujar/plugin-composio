#!/bin/bash

# Créer le répertoire .aws s'il n'existe pas
mkdir -p /home/node/.aws

# Créer le fichier config
cat > /home/node/.aws/config << EOL
[profile prod]
sso_session = kody
sso_account_id = ${AWS_PROD_ACCOUNT_ID}
sso_role_name = ${AWS_ROLE_NAME}
region = eu-west-3
output = json

[profile pre-prod]
sso_session = kody
sso_account_id = ${AWS_PREPROD_ACCOUNT_ID}
sso_role_name = ${AWS_ROLE_NAME}
region = eu-west-3
output = json

[sso-session kody]
sso_start_url = ${AWS_SSO_START_URL}
sso_region = ${AWS_SSO_REGION}
sso_registration_scopes = sso:account:access
EOL

# Définir les bonnes permissions
chown -R node:node /home/node/.aws
chmod 600 /home/node/.aws/config