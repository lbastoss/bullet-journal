# Bullet Journal

Bullet journal digital baseado no livro *O Método Bullet Journal* (Ryder Carroll) e no guia *Não é só um caderno*. Letra de escrita à mão, papel pontilhado, funciona no computador e no celular.

**No ar:** https://lbastos-journal.web.app

## O que tem

- **Dia:** registro rápido (• tarefa, ○ evento, – nota, ~ ideia), intenção do dia, termômetro do dia com prompts, humor, produtividade, estresse, sono e hábitos.
- **Semana:** foco, metas da semana, gráfico de humor, os 7 dias, próxima semana e check-out.
- **Mês:** check-in, metas nas 5 áreas da vida, calendário, tarefas do mês e reflexão.
- **Hábitos:** acompanhador mensal no modelo do guia (gráfico 0–10, sono e bolinhas por hábito).
- **Ano:** palavra do ano, metas, registro futuro e "ano em humor".
- **Coleções:** banco de prompts, registro de conteúdo e listas próprias.
- **Índice:** montado sozinho, com busca e `#temas`.
- **Migração automática:** tarefa não concluída passa para o dia seguinte com um lembrete de quantos dias está esperando.

## Tecnologia

- Vite + JavaScript, sem framework.
- Firebase Authentication (login com Google) e Firestore com cache offline.
- Firebase Hosting, no mesmo projeto do Controle Financeiro (`devlbills`), site `lbastos-journal`.
- Dados em `users/{uid}/bj_*`. As regras do Firestore (`firestore.rules`) só deixam cada usuário acessar os próprios dados.

## Rodar e publicar

```bash
npm install
cp .env.example .env   # preencher com as chaves do app web do Firebase
npm run dev            # http://localhost:5173
npm run deploy         # build + firebase deploy --only hosting
```

O deploy publica só o Hosting. As regras do Firestore são as mesmas do Controle Financeiro e ficam valendo para os dois apps.

## Acompanhamento

- [x] Versão 1: dia, semana, mês, ano, hábitos, coleções, índice e migração automática
- [x] Login com Google e sincronização entre aparelhos
- [ ] Revisão semanal guiada
- [ ] Sequência de dias seguidos por hábito
