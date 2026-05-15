```bash
#!/bin/bash

# =========================================================
# CONFIGURAÇÕES
# =========================================================

APP_USER="socialbot"
APP_HOME="/home/$APP_USER"

echo "========================================="
echo " Criando usuário da automação"
echo "========================================="

# =========================================================
# CRIA USUÁRIO
# =========================================================

sudo adduser --disabled-password --gecos "" $APP_USER

# Define senha
sudo passwd $APP_USER

# =========================================================
# ADICIONA AO GRUPO DOCKER
# =========================================================

sudo usermod -aG docker $APP_USER

# =========================================================
# CRIA ESTRUTURA DE PASTAS
# =========================================================

sudo mkdir -p $APP_HOME/app
sudo mkdir -p $APP_HOME/docker
sudo mkdir -p $APP_HOME/media/reels
sudo mkdir -p $APP_HOME/backups
sudo mkdir -p $APP_HOME/logs
sudo mkdir -p $APP_HOME/scripts

# =========================================================
# AJUSTA PERMISSÕES
# =========================================================

sudo chown -R $APP_USER:$APP_USER $APP_HOME

sudo chmod -R 755 $APP_HOME

# =========================================================
# CRIA ARQUIVO .ENV INICIAL
# =========================================================

sudo touch $APP_HOME/docker/.env

sudo chown $APP_USER:$APP_USER $APP_HOME/docker/.env

# =========================================================
# EXIBE RESULTADO
# =========================================================

echo ""
echo "========================================="
echo " Usuário criado com sucesso!"
echo "========================================="
echo ""
echo "Usuário: $APP_USER"
echo "Home: $APP_HOME"
echo ""
echo "Estrutura criada:"
echo ""
tree $APP_HOME
echo ""
echo "Agora faça login com:"
echo ""
echo "su - $APP_USER"
echo ""
echo "========================================="
```
