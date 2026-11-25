# Transferify 0.8.7

Transferência de artes entre After Effects, Illustrator, Figma e Photoshop (parcial).

**[Baixar a versão atual](https://github.com/barretobob/Transferify/releases/latest)** · **[Instalação Mac e Windows](Transferify/INSTALACAO.md)**

Versão de testes: Windows ainda em validação. Recursos e limites estão no [guia do Transferify](Transferify/README.md).

Após instalar, abra a engrenagem **⚙ → Update** para buscar atualizações. Reload também está nesse menu. Figma ↔ Illustrator é independente do After: mantenha somente o painel Illustrator aberto. Update no Figma usa um dos painéis Adobe abertos.

As abas destacam o destino selecionado e habilitam as funções dos aplicativos conectados. O Illustrator pode enviar a seleção diretamente ao Figma; nesse sentido, textos chegam como contornos vetoriais, sem edição tipográfica. Mantenha o plugin aberto no documento Figma que deve receber a arte.

O código está na pasta `Transferify`. Para gerar os assets de uma release, execute `python3 scripts/build_release.py`; publique o ZIP e `transferify-update.json` na mesma release estável.
