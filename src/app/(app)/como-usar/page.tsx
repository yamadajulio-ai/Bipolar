import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import Link from "next/link";

const sections = [
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    content: [
      "Ao criar sua conta, a tela Hoje mostra um assistente de configuração rápida.",
      "Defina seu horário de acordar e dormir — isso ajuda o sistema a proteger seu sono.",
      "Selecione rotinas comuns (café, almoço, jantar, medicação) e clique em \"Gerar minha primeira semana\".",
      "Pronto! Suas rotinas aparecem automaticamente todos os dias no planejador.",
    ],
    link: { href: "/hoje", label: "Ir para Hoje" },
  },
  {
    id: "tela-hoje",
    title: "Tela Hoje",
    content: [
      "A tela Hoje é seu painel diário. Ela mostra:",
      "• Próximo bloco do dia com contagem regressiva",
      "• Status do check-in, sono, energia e medicação",
      "• Barra de energia do dia (soma dos custos de energia dos blocos)",
      "• Ações rápidas: check-in, planejador, respiração e SOS",
      "Use essa tela como ponto de partida toda manhã.",
    ],
    link: { href: "/hoje", label: "Ver tela Hoje" },
  },
  {
    id: "planejador",
    title: "Agenda - Rotina",
    content: [
      "A agenda mostra sua semana em 7 colunas. Cada coluna é um dia.",
      "Clique no \"+\" de um dia para criar um novo bloco.",
      "Cada bloco tem uma categoria (sono, refeição, trabalho, etc.) e um tipo:",
      "• Âncora — protege sua estabilidade (ex: acordar, medicação, dormir)",
      "• Flexível — atividades normais que podem ser ajustadas",
      "• Risco — atividades que exigem atenção extra (ex: eventos sociais intensos)",
      "O sistema alerta automaticamente sobre conflitos de horário, noites tardias e atividades que invadem seus horários de âncora.",
    ],
    link: { href: "/planejador", label: "Abrir agenda" },
  },
  {
    id: "quick-add",
    title: "Adição rápida (Quick Add)",
    content: [
      "No topo da agenda, há um campo de texto para adicionar blocos rapidamente.",
      "Digite em linguagem natural. Exemplos:",
      "• \"amanhã 14-15 reunião\" — cria bloco de reunião amanhã das 14 às 15",
      "• \"seg 9h academia\" — cria bloco de academia segunda às 9h",
      "• \"hoje 12-13 almoço\" — cria bloco de almoço hoje",
      "O sistema detecta a categoria automaticamente pela palavra (reunião = trabalho, academia = exercício, almoço = refeição).",
      "Se o texto não tiver todas as informações, o modal de edição abre já preenchido com o que foi entendido.",
    ],
  },
  {
    id: "smart-defaults",
    title: "Preenchimento automático",
    content: [
      "Ao criar um novo bloco e mudar a categoria, o sistema preenche automaticamente:",
      "• Duração típica (ex: refeição = 30min, trabalho = 2h)",
      "• Custo de energia (ex: sono = 0, trabalho = 7)",
      "• Nível de estimulação (ex: refeição = baixa, social = alta)",
      "• Tipo do bloco (ex: sono e medicação = âncora, social = risco)",
      "Você pode ajustar qualquer valor depois — são apenas sugestões para economizar tempo.",
    ],
  },
  {
    id: "templates",
    title: "Templates de semana",
    content: [
      "Quando sua semana estiver bem organizada, salve-a como template para reutilizar.",
      "No planejador, clique em \"Template\" e depois \"Salvar semana atual como template\".",
      "Para aplicar um template em outra semana, escolha o template e o modo:",
      "• Mesclar — adiciona blocos sem sobrepor os existentes",
      "• Preencher — só adiciona onde não existe bloco no mesmo horário",
      "• Substituir — remove blocos não-rotina da semana e aplica o template",
      "Gerencie seus templates em Mais > Templates.",
    ],
    link: { href: "/mais/templates", label: "Ver templates" },
  },
  {
    id: "rotinas",
    title: "Rotinas",
    content: [
      "Rotinas são blocos que repetem automaticamente todos os dias (ou em dias específicos).",
      "Para criar uma rotina: crie um bloco com recorrência (diária ou semanal) e marque como rotina.",
      "Rotinas aparecem automaticamente em todas as semanas, sem precisar copiar ou reaplicar.",
      "Para pausar ou remover uma rotina, vá em Mais > Rotinas.",
      "Dica: suas âncoras (acordar, refeições, medicação, dormir) são os melhores candidatos a rotina.",
    ],
    link: { href: "/mais/rotinas", label: "Ver rotinas" },
  },
  {
    id: "copiar-semana",
    title: "Copiar semana",
    content: [
      "No planejador, clique em \"Copiar semana\" para trazer blocos de uma semana anterior.",
      "Escolha a semana de origem e o que copiar:",
      "• Tudo — copia todos os blocos",
      "• Só Flex — copia apenas blocos flexíveis",
      "• Sem Âncoras — copia tudo exceto âncoras",
      "Rotinas são ignoradas automaticamente (já repetem sozinhas). Duplicatas são detectadas.",
    ],
  },
  {
    id: "checkin",
    title: "Check-in de 30 segundos",
    content: [
      "O check-in é seu registro diário rápido. Leva menos de 30 segundos.",
      "Registre: humor (1-5), energia, ansiedade, irritabilidade, horas de sono e medicação.",
      "Opcionalmente, marque sinais de alerta precoces (insônia, gastos excessivos, irritabilidade, etc.).",
      "Fazer check-in regularmente ajuda a identificar padrões ao longo do tempo.",
      "Dica: faça o check-in sempre no mesmo horário para criar um hábito.",
    ],
    link: { href: "/checkin", label: "Fazer check-in" },
  },
  {
    id: "insights",
    title: "Insights de estabilidade",
    content: [
      "A tela de insights mostra padrões baseados nos seus dados:",
      "• Regularidade de sono — variância dos horários de dormir e acordar",
      "• Regularidade de âncoras — consistência dos seus horários-âncora (IPSRT)",
      "• Carga semanal de energia — soma dos custos de energia dos blocos",
      "• Noites de risco — quantas vezes atividades passaram do horário limite",
      "Essas informações são observações automáticas, não diagnósticos. Compartilhe com seu profissional de saúde.",
    ],
    link: { href: "/insights", label: "Ver insights" },
  },
  {
    id: "exercicios",
    title: "Exercícios de respiração e aterramento",
    content: [
      "Exercícios guiados para momentos de ansiedade, insônia ou agitação:",
      "• Respiração 4-7-8 — ideal para insônia (inspirar 4s, segurar 7s, expirar 8s)",
      "• Respiração quadrada — para ansiedade (4 tempos iguais)",
      "• Respiração diafragmática — para aterramento",
      "• 5 Sentidos (5-4-3-2-1) — aterramento sensorial",
      "• Relaxamento muscular progressivo — para tensão",
      "Cada exercício tem animação visual e tempo guiado. Sem pressa, no seu ritmo.",
    ],
    link: { href: "/exercicios", label: "Ver exercícios" },
  },
  {
    id: "crise",
    title: "Plano de crise",
    content: [
      "O plano de crise é pessoal e pode ser editado a qualquer momento.",
      "Cadastre: contatos de confiança, profissional de saúde, medicamentos atuais, hospital de preferência e estratégias pessoais.",
      "Em momentos difíceis, use o botão SOS (vermelho) no topo da tela para acesso rápido a:",
      "• Números de emergência (CVV 188, SAMU 192)",
      "• Respiração de emergência",
      "• Exercício para insônia",
    ],
    link: { href: "/plano-de-crise", label: "Ver plano de crise" },
  },
  {
    id: "dicas",
    title: "Dicas para estabilidade",
    content: [
      "Essas dicas são baseadas em práticas comuns de manejo do TAB:",
      "• Proteja suas âncoras — acordar, refeições e dormir no mesmo horário todos os dias",
      "• Defina um horário limite noturno — evite atividades estimulantes depois desse horário",
      "• Monitore sua carga de energia — dias com muita carga exigem mais descanso",
      "• Faça check-in diário — mesmo que rápido, ajuda a perceber mudanças cedo",
      "• Use rotinas — quanto menos decisões no dia a dia, mais energia para o que importa",
      "• Compartilhe seus insights com seu profissional de saúde",
      "Lembre-se: este aplicativo é uma ferramenta de apoio, não substitui acompanhamento profissional.",
    ],
  },
];

export default function ComoUsarPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Como usar</h1>

      <Alert variant="info" className="mb-6">
        Este guia explica as funcionalidades do sistema. Use no seu ritmo, sem pressa.
        Para dúvidas sobre seu tratamento, consulte seu profissional de saúde.
      </Alert>

      {/* Table of contents */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Índice</h2>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded px-2 py-1 text-sm text-primary no-underline hover:bg-primary/5"
            >
              {s.title}
            </a>
          ))}
        </div>
      </Card>

      {/* Sections */}
      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            <Card>
              <div className="space-y-2 text-sm leading-relaxed text-muted">
                {section.content.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              {section.link && (
                <div className="mt-3 border-t border-border pt-3">
                  <Link
                    href={section.link.href}
                    className="text-sm font-medium text-primary no-underline hover:underline"
                  >
                    {section.link.label} &rarr;
                  </Link>
                </div>
              )}
            </Card>
          </section>
        ))}
      </div>

      {/* Back to top */}
      <div className="mt-8 text-center">
        <a href="#" className="text-sm text-muted no-underline hover:text-foreground">
          Voltar ao topo
        </a>
      </div>
    </div>
  );
}
