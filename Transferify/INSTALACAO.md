# Instalação — Transferify 0.8.4

Pacote de testes para After Effects e Illustrator, com plugin Figma e integração parcial Photoshop. Use apps Adobe com suporte a painéis CEP. Windows ainda não foi validado em um computador Windows.

## Mac

1. Feche After Effects e Illustrator. Extraia o ZIP.
2. No Finder, use **Ir → Ir para a Pasta…** e abra:
   `~/Library/Application Support/Adobe/CEP/extensions/`
   Crie as pastas que faltarem.
3. Copie a pasta **Transferify** inteira para esse local. O resultado deve ser:
   `~/Library/Application Support/Adobe/CEP/extensions/Transferify/CSXS/manifest.xml`
   Não copie apenas os arquivos internos e não crie duas pastas Transferify aninhadas.
4. Por ser uma extensão de desenvolvimento sem assinatura ZXP, ative PlayerDebugMode para o runtime CEP utilizado pelos seus apps. Para CEP 12, abra Terminal e execute:

   ```sh
   defaults write com.adobe.CSXS.12 PlayerDebugMode 1
   ```

   Se o app usar CEP 11 ou 10, substitua `12` pelo número correspondente. O número é do CEP, não do Transferify. Consulte os logs `~/Library/Logs/CSXS/` para identificar o runtime. Se a preferência não surtir efeito, encerre a sessão do macOS e entre novamente.
5. Abra os apps e procure **Janela → Extensões → Transferify 0.8.4**. Dependendo do app, o submenu aparece como **Extensões (Legado)**.

## Windows

1. Feche After Effects e Illustrator. Extraia o ZIP por completo.
2. Pressione **Win + R**, cole `%APPDATA%\Adobe\CEP\extensions\` e confirme. Crie as pastas ausentes.
3. Copie a pasta **Transferify** inteira para esse local. O resultado deve ser:
   `%APPDATA%\Adobe\CEP\extensions\Transferify\CSXS\manifest.xml`
4. Ative PlayerDebugMode para seu runtime CEP. Para CEP 12, execute no **Prompt de Comando** comum, sem precisar de administrador:

   ```bat
   reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
   ```

   Para CEP 11 ou 10, troque `12` pelo número correto. Os logs `CEP*-AEFT*.log` e `CEP*-ILST*.log` em `%LOCALAPPDATA%\Temp\` ajudam a identificar a versão.
5. Abra os apps e procure **Window/Janela → Extensions/Extensões (Legacy/Legado) → Transferify 0.8.4**.

Esses passos seguem os diretórios e a configuração de desenvolvimento descritos pela [Adobe no guia CEP](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions).

## Preparar o After

- Nas preferências, em **Scripting & Expressions / Scripts e expressões**, habilite **Allow Scripts to Write Files and Access Network / Permitir que scripts gravem arquivos e acessem a rede**. No Mac, Preferências pode aparecer como Ajustes/Settings.
- Salve o projeto `.aep` antes de enviar imagens, ou escolha a pasta pelo botão IMG FOLDER.
- Para Illustrator → After, deixe uma composição de destino ativa, ou use **CREATE COMP FROM ARTBOARD** no painel Illustrator primeiro.
- Instale as mesmas fontes usadas nos arquivos de origem.

## Figma — Mac e Windows

1. Use o aplicativo **Figma Desktop** e abra um arquivo Design.
2. Abra **Plugins → Development → Import new plugin from manifest…**.
3. Escolha o `figma-plugin/manifest.json` que está **dentro da pasta Transferify instalada no CEP do usuário**, não dentro do ZIP ou em Downloads. Essa localização permanente permite que Update atualize também o plugin.
4. Execute **Transferify 0.8.4** em Plugins → Development.
5. Abra o painel Transferify no After no mesmo computador e aguarde a conexão. A ponte utiliza `localhost:17860`. Deixe só um painel After receptor aberto. Para Figma ↔ Illustrator, mantenha também o painel After aberto.

A importação de um manifesto local é o procedimento de desenvolvimento documentado pelo [Figma](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development). Não é uma instalação pela Figma Community.

## Photoshop

Não há um painel Transferify separado para instalar no Photoshop. Abra o documento PSD no Photoshop e use **PUSH FROM PS**, **IMPORT GUIDES FROM PS** ou **PUSH GUIDES TO PS** no Transferify do After. O fluxo PSD utiliza uma cópia em disco. Texto e shapes nativos editáveis no After ainda estão pendentes.

## Update e Reload

- Clique **⚙ → Update** em qualquer interface. No Figma, o painel After precisa estar aberto para baixar e instalar os arquivos.
- A instalação deve estar na pasta CEP do usuário, com permissão de escrita. Uma instalação antiga em pasta de sistema pode exigir migração única para a pasta de usuário.
- O updater consulta a última release pública estável, valida os arquivos e preserva um backup em `~/.transferify/backups` (no Windows, dentro da pasta de perfil do usuário).
- Depois de atualizar, feche e reabra os painéis Adobe e o plugin Figma. Se necessário, reinicie os apps depois de salvar o trabalho. **Reload** recarrega a interface; no Figma, fechar/reabrir também carrega o código principal novo.
- Remova instalações antigas dos diretórios CEP, guardando backups fora deles. Não mantenha duas cópias com o mesmo ID, incluindo a antiga pasta Transferify_QA_0.7.0.
- Um plugin Figma importado de outra pasta continua apontando para ela. Para migrar, importe uma vez o manifesto dentro da instalação CEP permanente.

## Primeiro teste

1. Salve um AEP de teste em `Projeto/AEP/Teste.aep` e crie uma comp.
2. Envie do Illustrator um texto, retângulo, elipse, gradiente e imagem. Confira posição, aparência e edição.
3. Envie do Figma um Frame com texto, fundo e imagem em NEW; repita em CURRENT.
4. Confira os arquivos em `Projeto/IMAGENS`; teste também uma pasta manual e o retorno ↺ ao automático.
5. Envie shapes e textos do After para o Illustrator.
6. Se usar Photoshop, teste PSD simples em camadas e guias.
7. Abra ⚙ → Update: sem versão mais nova, deve informar que já está atualizado.

## Se não abrir ou não conectar

Confira a estrutura de pastas, PlayerDebugMode do runtime correto, apps reiniciados e instalações duplicadas. A extensão precisa aparecer com a versão 0.8.4. No Figma, use o plugin do mesmo pacote e reabra-o após substituir arquivos. Se a porta 17860 estiver em uso por outro Transferify, feche o receptor antigo e reabra o atual. Não desative firewall ou antivírus globalmente para testar.

Registre sistema, versões dos apps, mensagem exata e captura do problema ao reportar. A instalação no Windows e os recursos de atualização precisam de validação nos ambientes de destino; nenhum documento garante funcionamento com todos os efeitos e versões Adobe.
