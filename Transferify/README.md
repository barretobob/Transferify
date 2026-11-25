# Transferify 0.8.5 — versão de testes

Transfere artes entre After Effects, Illustrator, Figma e, parcialmente, Photoshop.

## Instalação

Veja [INSTALACAO.md](INSTALACAO.md) para Mac, Windows, plugin Figma e atualizações. O painel Adobe é instalado uma vez na pasta CEP do usuário. O plugin Figma deve ser importado a partir da subpasta `figma-plugin` dessa mesma instalação permanente.

## Atualizar

Abra a engrenagem **⚙ → Update** no After, Illustrator ou Figma. A atualização consulta a última release publicada neste repositório, verifica os arquivos e guarda a instalação anterior em `~/.transferify/backups` (pasta do usuário no Mac e Windows). **⚙ → Reload** recarrega a interface. Depois de atualizar, feche e reabra os painéis Adobe e o plugin Figma; reinicie os apps após salvar o trabalho se o menu permanecer antigo. Update no Figma precisa de um painel Transferify aberto no Illustrator ou no After. Não há atualização silenciosa nem reinício automático.

O plugin Figma importado de outra pasta, como Downloads, não é atualizado junto: importe uma vez o manifesto da instalação CEP permanente. No seu próprio computador, mantenha o plugin e o painel do mesmo pacote.

## Funções e limites

- Illustrator → After: textos, paths, shapes, gradientes, imagens e guias compatíveis.
- After → Illustrator: textos, shapes, guias; vídeo vira PNG do quadro atual no tamanho original. Sólido com máscara compatível vira vetor com clipping mask. Feather não é reproduzido nesse clipping.
- Figma → After: texto e vetores editáveis quando compatíveis, imagens, hierarquia e opções NEW/CURRENT. O fundo do Frame original pode acompanhar o tamanho da comp. Imagens de fundo de containers são enviadas separadamente.
- Figma ↔ Illustrator: conexão SVG direta com o painel Illustrator; textos no caminho Illustrator → Figma podem ser contornados.
- Photoshop → After: cópia PSD importada em camadas, preservando o documento original. Guias nos dois sentidos. Texto e shapes nativos editáveis, máscaras e efeitos ainda precisam de desenvolvimento/validação. After → Photoshop em camadas não está implementado.
- PRECOMP, DECOMP, JOIN e SPLIT para estruturas compatíveis. JOIN consolida transforms no quadro atual; não preserva toda a animação dos transforms. PRECOMP tem margem de 10 px e recusa expressions de Position. DECOMP não suporta time remapping.

Na estrutura `Projeto/AEP/arquivo.aep`, o destino padrão é `Projeto/IMAGENS`. O botão de pasta permite outro destino; ↺ restaura o automático. Se o AEP estiver na raiz do projeto, usa IMAGENS nessa raiz. Também reconhece uma IMAGENS existente um nível acima. Salve o AEP ou escolha uma pasta antes de enviar imagens.

Desenvolvido e testado em macOS. **Windows ainda em validação**, inclusive instalação, diferenças de paths, fontes, CEP e comunicação entre apps. A faixa de versões no manifesto não constitui garantia de compatibilidade. Efeitos complexos, fontes, recortes e gerenciamento de cor podem produzir diferenças. Faça os primeiros testes numa cópia do projeto.

## Reportar um problema

Abra uma issue com sistema operacional, versões dos apps, versão Transferify, direção do envio, passos de reprodução e mensagem exata. Se possível, anexe um arquivo mínimo sem material confidencial e capturas de origem/destino.

## Desenvolvimento

O código da extensão fica nesta pasta. `scripts/build_release.py`, na raiz do repositório, produz o ZIP e `transferify-update.json` para uma release. Esse arquivo é a carga de atualização usada pelos painéis; os dois assets devem ser publicados na mesma tag. O cliente usa a última release pública estável do GitHub (rascunhos e prereleases não entram em Update).

Na 0.8.5, a cópia de gradientes usa o ID da camada criada e remove a geometria auxiliar do template. Validado em teste nativo com duas sombras dentro de precomp, sem retângulo ou camada auxiliar remanescentes.

## Fluxos independentes na 0.8.5

Figma ↔ Illustrator exige apenas Figma e o painel Transferify do Illustrator aberto. Não abre nem usa o After. Figma ↔ After usa somente o receptor do After. Illustrator ↔ After continua por comunicação direta entre esses dois aplicativos. Cada receptor tem sua própria porta e sessão local: After 17860, Illustrator 17861.

Figma ↔ Photoshop e o fluxo completo Photoshop ↔ After ficam para implementação futura. O PUSH FROM PS legado permanece experimental; não equivale a uma integração completa validada.
