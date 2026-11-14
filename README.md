# Cereja Esmalteria — site + agendamento + painel

MVP em **React 18 + TypeScript + Tailwind CSS + Framer Motion + Recharts**, com camada de dados que roda
no navegador (demonstração) ou no **Firebase** (produção), sem mudar a interface.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes da agenda, do Pix e dos dados de exemplo
npm run build      # gera dist/ (site estático, hospede em Vercel, Netlify ou Firebase Hosting)
```

Painel: `/#/admin`. No modo local, todos os acessos usam a senha `cereja123`:

| E-mail | Papel | Vê |
|---|---|---|
| admin@cereja.com | Administradora | tudo, inclusive faturamento e usuários |
| recepcao@cereja.com | Recepção | agenda de todas, clientes, painel sem valores |
| jessica@cereja.com (priscila@, dani@) | Profissional | só a própria agenda |

## O que tem

**Site público**
- Hero com a mão animada pelo scroll: 81 quadros do vídeo desenhados num `<canvas>` conforme a rolagem,
  com interpolação suave, inclinação 3D e "giro" da mão seguindo o mouse, e textos que trocam em 4 etapas.
- Serviços mais realizados (ranking calculado dos atendimentos concluídos nos últimos 30 dias).
- Equipe com nome, função, serviços e **próximo horário livre de hoje** calculado da agenda.
- Local com status **Aberto/Fechado** em tempo real (fuso America/Bahia), horários e rota.
- **Login da cliente com e-mail verificado antes de agendar.** Modo local: código de 6 dígitos
  (vale 10 min, 5 tentativas, reenvio a cada 30 s, uso único). Firebase: link de login enviado ao e-mail.
  No primeiro acesso pede nome e WhatsApp; se o WhatsApp já tem histórico no salão, as fichas são unidas.
  A cliente continua logada entre visitas e sai pelo menu com o nome dela no topo.
- Quem é da equipe e está logado vê o botão **Painel · Administradora/Recepção/Profissional** no topo do site.
  Administradora e recepção logadas agendam direto em nome da cliente, sem o login por e-mail.
- Agendamento real em 5 passos: serviço → profissional (ou primeira livre) → dia/horário → dados → pagamento.
  Os horários respeitam expediente, duração do serviço, agenda de cada profissional e antecedência de 30 min,
  e são revalidados no momento de gravar (sem reserva dupla).
- Pagamento: **Pix com QR Code e copia e cola reais** (BR Code EMV com CRC16, testado contra o exemplo do
  Banco Central), cartão (link de pagamento configurável ou maquininha) ou no salão.
- "Meus horários": lista os horários da conta logada, com cancelamento até 2 h antes; arquivo .ics e confirmação no WhatsApp.

**Painel (admin)**
- Dashboard: faturamento, atendimentos, ticket médio e faltas com comparação ao período anterior;
  gráfico diário/semanal; próximos horários; serviços mais feitos; desempenho por profissional;
  formas de pagamento; clientes sumidas; alerta de Pix a conferir.
- Agenda: linha do tempo por profissional, lista dos próximos 7 dias, fila de Pix a conferir,
  ações (confirmar, concluir, faltou, cancelar, registrar pagamento, lembrete no WhatsApp) e novo agendamento.
- Clientes sumidas: filtro por 30/45/60/90 dias sem vir, gasto e serviço preferido, botão "Chamar de volta"
  que abre o WhatsApp com mensagem personalizada (modelo editável com `{nome}`, `{dias}`, `{servico}`).
- Serviços: ranking com participação, média semanal e faturamento; editar preço, duração, quem faz e disponibilidade.
- Usuários: criar, editar papel, vincular agenda, trocar senha, desativar e excluir (com proteção da última admin).

## Ligar o Firebase (produção)

1. Crie o projeto no console, ative **Authentication › E-mail/senha** com a opção
   **Link do e-mail (login sem senha)** e o **Firestore**. Em Authentication › Configurações ›
   Domínios autorizados, inclua o domínio onde o site vai ficar.
2. Copie `.env.example` para `.env`, preencha as variáveis `VITE_FIREBASE_*` e use `VITE_DATA_PROVIDER=firebase`.
3. Publique as regras: `firebase deploy --only firestore:rules` (arquivo `firestore.rules`).
4. Cadastre a primeira administradora: crie o usuário no Authentication e o documento
   `users/{uid}` com `{ name, email, role: "admin", active: true, createdAt }`.
5. Cadastre `services` e `pros` (mesmo formato de `src/data/seed.ts`). Depois disso, novos usuários
   são criados pelo próprio painel.

Como funciona a proteção contra reserva dupla: cada agendamento ocupa blocos de 15 min em `slots/`
(sem nome nem telefone). A gravação é uma transação; se qualquer bloco já existir, nada é gravado e a
cliente recebe "esse horário acabou de ser reservado".

Limites honestos do modo Firebase: o Pix estático não confirma o pagamento sozinho (a cliente toca em
"Já paguei" e a equipe confere no banco); para baixa automática, integre um PSP (Mercado Pago, Efí, Asaas)
com webhook numa Cloud Function. A troca de senha de outra pessoa é feita por e-mail de redefinição.
As regras e o `FirebaseRepo` compilam, mas devem ser testados no emulador antes de ir ao ar.

## Envio do código por e-mail (modo local)

Sem configuração, o código aparece na tela com o aviso "Modo demonstração", para você apresentar o MVP.
Para enviar de verdade sem backend, crie uma conta grátis no EmailJS, um template com destinatário
`{{to_email}}` e o texto "Seu código Cereja é {{code}}", e preencha `VITE_EMAILJS_*` no `.env`.
Atenção: no modo local o código é conferido no próprio navegador, o que serve para validar o produto,
não como segurança de produção. Em produção use o modo Firebase, onde a verificação é feita pelo servidor.

## Adaptar para outra empresa

- `src/lib/business.ts`: nome, endereço, WhatsApp, horários e regras de agenda.
- `src/data/seed.ts`: serviços, equipe e usuários iniciais.
- `tailwind.config.js`: cores; fontes em `index.html` (Bagel Fat One + Figtree, as mesmas do MVP anterior).
- `public/frames/`: 120 quadros do hero (`f000.webp` a `f119.webp`), com fundo transparente,
  extraídos do vídeo `unhas-3s.mp4` (3 s, gerado no Luma AI). Veja "Trocar o vídeo do hero" abaixo.

## Trocar o vídeo do hero

O hero não toca o vídeo: ele desenha um quadro por vez num `<canvas>` conforme a rolagem, o que
deixa o movimento preso ao scroll (para frente e para trás) e funciona igual em todos os navegadores.

1. Prefira um vídeo curto (2 a 4 s), com a mão inteira e **fundo liso e neutro** (cinza ou branco).
2. Extraia os quadros: `ffmpeg -i video.mp4 quadros/f%03d.png`
3. Remova o fundo de cada quadro (o projeto usou `rembg` com o modelo `u2net`, somado a uma máscara
   por saturação de cor para não perder pele) e salve como WebP com transparência em `public/frames/`,
   numerados a partir de `f000.webp`.
4. Em `src/components/HeroScroll.tsx`, ajuste `FRAME_COUNT` (número de quadros), `FRAME_RATIO`
   (largura / altura) e os `from` de cada legenda em `LOOKS` (o quadro em que cada legenda aparece).

Vídeos gerados por IA no plano gratuito costumam vir com marca d'água e uso só não comercial;
para um site de cliente, exporte pelo plano pago, sem marca d'água.

## Estrutura

```
src/
  lib/          regras puras: agenda, Pix, horários, métricas (com testes)
  data/         Repo (contrato), LocalRepo, FirebaseRepo, seed
  components/   HeroScroll, Booking, PixPayment, ui
  pages/        Home (site) e admin/ (Dashboard, Agenda, Clients, Services, Users)
```
