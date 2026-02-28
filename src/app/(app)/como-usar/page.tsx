import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import Link from "next/link";

const sections = [
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    content: [
      "Ao criar sua conta, a tela Hoje mostra um assistente de configuracao rapida.",
      "Defina seu horario de acordar e dormir — isso ajuda o sistema a proteger seu sono.",
      "Selecione rotinas comuns (cafe, almoco, jantar, medicacao) e clique em \"Gerar minha primeira semana\".",
      "Pronto! Suas rotinas aparecem automaticamente todos os dias no planejador.",
    ],
    link: { href: "/hoje", label: "Ir para Hoje" },
  },
  {
    id: "tela-hoje",
    title: "Tela Hoje",
    content: [
      "A tela Hoje e seu painel diario. Ela mostra:",
      "• Proximo bloco do dia com contagem regressiva",
      "• Status do check-in, sono, energia e medicacao",
      "• Barra de energia do dia (soma dos custos de energia dos blocos)",
      "• Acoes rapidas: check-in, planejador, respiracao e SOS",
      "Use essa tela como ponto de partida toda manha.",
    ],
    link: { href: "/hoje", label: "Ver tela Hoje" },
  },
  {
    id: "planejador",
    title: "Planejador semanal",
    content: [
      "O planejador mostra sua semana em 7 colunas. Cada coluna e um dia.",
      "Clique no \"+\" de um dia para criar um novo bloco.",
      "Cada bloco tem uma categoria (sono, refeicao, trabalho, etc.) e um tipo:",
      "• Ancora — protege sua estabilidade (ex: acordar, medicacao, dormir)",
      "• Flexivel — atividades normais que podem ser ajustadas",
      "• Risco — atividades que exigem atencao extra (ex: eventos sociais intensos)",
      "O sistema alerta automaticamente sobre conflitos de horario, noites tardias e atividades que invadem seus horarios de ancora.",
    ],
    link: { href: "/planejador", label: "Abrir planejador" },
  },
  {
    id: "quick-add",
    title: "Adicao rapida (Quick Add)",
    content: [
      "No topo do planejador, ha um campo de texto para adicionar blocos rapidamente.",
      "Digite em linguagem natural. Exemplos:",
      "• \"amanha 14-15 reuniao\" — cria bloco de reuniao amanha das 14 as 15",
      "• \"seg 9h academia\" — cria bloco de academia segunda as 9h",
      "• \"hoje 12-13 almoco\" — cria bloco de almoco hoje",
      "O sistema detecta a categoria automaticamente pela palavra (reuniao = trabalho, academia = exercicio, almoco = refeicao).",
      "Se o texto nao tiver todas as informacoes, o modal de edicao abre ja preenchido com o que foi entendido.",
    ],
  },
  {
    id: "smart-defaults",
    title: "Preenchimento automatico",
    content: [
      "Ao criar um novo bloco e mudar a categoria, o sistema preenche automaticamente:",
      "• Duracao tipica (ex: refeicao = 30min, trabalho = 2h)",
      "• Custo de energia (ex: sono = 0, trabalho = 7)",
      "• Nivel de estimulacao (ex: refeicao = baixa, social = alta)",
      "• Tipo do bloco (ex: sono e medicacao = ancora, social = risco)",
      "Voce pode ajustar qualquer valor depois — sao apenas sugestoes para economizar tempo.",
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
      "• Preencher — so adiciona onde nao existe bloco no mesmo horario",
      "• Substituir — remove blocos nao-rotina da semana e aplica o template",
      "Gerencie seus templates em Mais > Templates.",
    ],
    link: { href: "/mais/templates", label: "Ver templates" },
  },
  {
    id: "rotinas",
    title: "Rotinas",
    content: [
      "Rotinas sao blocos que repetem automaticamente todos os dias (ou em dias especificos).",
      "Para criar uma rotina: crie um bloco com recorrencia (diaria ou semanal) e marque como rotina.",
      "Rotinas aparecem automaticamente em todas as semanas, sem precisar copiar ou reaplicar.",
      "Para pausar ou remover uma rotina, va em Mais > Rotinas.",
      "Dica: suas ancoras (acordar, refeicoes, medicacao, dormir) sao os melhores candidatos a rotina.",
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
      "• So Flex — copia apenas blocos flexiveis",
      "• Sem Ancoras — copia tudo exceto ancoras",
      "Rotinas sao ignoradas automaticamente (ja repetem sozinhas). Duplicatas sao detectadas.",
    ],
  },
  {
    id: "checkin",
    title: "Check-in de 30 segundos",
    content: [
      "O check-in e seu registro diario rapido. Leva menos de 30 segundos.",
      "Registre: humor (1-5), energia, ansiedade, irritabilidade, horas de sono e medicacao.",
      "Opcionalmente, marque sinais de alerta precoces (insonia, gastos excessivos, irritabilidade, etc.).",
      "Fazer check-in regularmente ajuda a identificar padroes ao longo do tempo.",
      "Dica: faca o check-in sempre no mesmo horario para criar um habito.",
    ],
    link: { href: "/checkin", label: "Fazer check-in" },
  },
  {
    id: "insights",
    title: "Insights de estabilidade",
    content: [
      "A tela de insights mostra padroes baseados nos seus dados:",
      "• Regularidade de sono — variancia dos horarios de dormir e acordar",
      "• Regularidade de ancoras — consistencia dos seus horarios-ancora (IPSRT)",
      "• Carga semanal de energia — soma dos custos de energia dos blocos",
      "• Noites de risco — quantas vezes atividades passaram do horario limite",
      "Essas informacoes sao observacoes automaticas, nao diagnosticos. Compartilhe com seu profissional de saude.",
    ],
    link: { href: "/insights", label: "Ver insights" },
  },
  {
    id: "exercicios",
    title: "Exercicios de respiracao e aterramento",
    content: [
      "Exercicios guiados para momentos de ansiedade, insonia ou agitacao:",
      "• Respiracao 4-7-8 — ideal para insonia (inspirar 4s, segurar 7s, expirar 8s)",
      "• Respiracao quadrada — para ansiedade (4 tempos iguais)",
      "• Respiracao diafragmatica — para aterramento",
      "• 5 Sentidos (5-4-3-2-1) — aterramento sensorial",
      "• Relaxamento muscular progressivo — para tensao",
      "Cada exercicio tem animacao visual e tempo guiado. Sem pressa, no seu ritmo.",
    ],
    link: { href: "/exercicios", label: "Ver exercicios" },
  },
  {
    id: "crise",
    title: "Plano de crise",
    content: [
      "O plano de crise e pessoal e pode ser editado a qualquer momento.",
      "Cadastre: contatos de confianca, profissional de saude, medicamentos atuais, hospital de preferencia e estrategias pessoais.",
      "Em momentos dificeis, use o botao SOS (vermelho) no topo da tela para acesso rapido a:",
      "• Numeros de emergencia (CVV 188, SAMU 192)",
      "• Respiracao de emergencia",
      "• Exercicio para insonia",
    ],
    link: { href: "/plano-de-crise", label: "Ver plano de crise" },
  },
  {
    id: "dicas",
    title: "Dicas para estabilidade",
    content: [
      "Essas dicas são baseadas em práticas comuns de manejo do TAB:",
      "• Proteja suas ancoras — acordar, refeicoes e dormir no mesmo horario todos os dias",
      "• Defina um horario limite noturno — evite atividades estimulantes depois desse horario",
      "• Monitore sua carga de energia — dias com muita carga exigem mais descanso",
      "• Faca check-in diario — mesmo que rapido, ajuda a perceber mudancas cedo",
      "• Use rotinas — quanto menos decisoes no dia a dia, mais energia para o que importa",
      "• Compartilhe seus insights com seu profissional de saude",
      "Lembre-se: este aplicativo e uma ferramenta de apoio, nao substitui acompanhamento profissional.",
    ],
  },
];

export default function ComoUsarPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Como usar</h1>

      <Alert variant="info" className="mb-6">
        Este guia explica as funcionalidades do sistema. Use no seu ritmo, sem pressa.
        Para duvidas sobre seu tratamento, consulte seu profissional de saude.
      </Alert>

      {/* Table of contents */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Indice</h2>
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
