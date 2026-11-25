Transferify 0.8.7 — abas de destino e envio Illustrator → Figma.

- Abas no After, Illustrator e Figma, com destaque azul no destino selecionado. Cada interface omite o próprio aplicativo e habilita as funções dos destinos conectados.
- SEND TO FIGMA no Illustrator, com confirmação do recebimento no plugin Figma. PUSH FROM AI continua disponível no Figma. Textos do Illustrator chegam como contornos vetoriais editáveis, sem edição tipográfica.
- Transferências vinculadas à sessão e página do Figma que iniciou a conexão; documentos inativos não consomem os envios.
- Figma ↔ Illustrator funciona com o After fechado. Exportação da seleção sem criar documentos ou artboards temporários; seleção e painel de assets da origem são restaurados.
- Figma → Illustrator remove grupos de transporte, preserva um nível dos grupos explícitos e os recortes necessários. Artboards com 150 px entre bordas em ordem de leitura; ao atingir a margem direita nativa, continua na linha abaixo.
- Mantém o tamanho original do Frame e o recorte seletivo apenas dos objetos que ultrapassam o artboard.

Validado no macOS com o QA Illustrator → novo documento Figma, incluindo shapes, compound path, strokes, textos contornados, gradiente e imagens. Testes automatizados cobrem abas, comunicação independente, confirmação, deduplicação, isolamento entre documentos, importação, layout e updater. A integração completa do After não foi repetida nesta rodada. Windows e integração Photoshop continuam em validação.

Reabra os painéis Adobe e o plugin Figma após atualizar. Baixe Transferify_0.8.7.zip e leia Transferify/INSTALACAO.md.
