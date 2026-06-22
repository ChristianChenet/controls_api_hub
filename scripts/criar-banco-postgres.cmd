@echo off
echo Criando banco PostgreSQL control_s_api_hub...
psql -U postgres -c "CREATE DATABASE control_s_api_hub;"
echo Se o banco ja existir, ignore a mensagem de erro de duplicidade.
