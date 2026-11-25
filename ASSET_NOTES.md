# Recursos binários do Transferify

`Transferify/assets/georama-bold.ttf` é a fonte Georama Bold, distribuída pelo Google Fonts sob a SIL Open Font License. A licença está em `Transferify/assets/Georama-OFL.txt`. A mesma fonte é incorporada na interface do plugin Figma para uso local, sem requisições de fonte externas. Fonte e licença: https://github.com/google/fonts/tree/main/ofl/georama.

Os dois recursos de gradiente são templates técnicos sintéticos, necessários para criar preenchimentos nativos do After. Não são artes de cliente.

- `gradient-template.aep`: projeto RIFX com uma composição `Transferify Gradient Template` e uma shape layer `Transferify Gradient`, paths e um preenchimento de gradiente. Não contém fotos ou vídeos. O XMP externo foi removido; o nome de workspace foi substituído por Default.
- `gradient-record.bin`: registro de propriedades de gradiente com XML de duas paradas de cor e alfa. Os valores são substituídos pelo importador. Não contém credenciais, arquivos de mídia ou caminhos locais.

O identificador `figma-client-id.txt` é público e vale 64 zeros. Não é uma chave de conta. A autorização das requisições locais usa um token de sessão aleatório, gerado a cada inicialização da ponte. Nenhuma chave privada da instalação de desenvolvimento é distribuída.

Inspeção dos arquivos: UTF-8 e UTF-16, sem caminhos de usuário, emails, nomes de clientes ou tokens de contas. O template sanitizado termina no tamanho declarado pelo RIFX.

SHA-256:
- gradient-template.aep: `8c490febe372ff07be3bb29b7b1a106a4ee7c56d36788777f13dc73dfbceea26`
- gradient-record.bin: `54f1416ac4f6cb0a267dc35aca52bf5f24adfc232c756802fc9ff603f6191270`
