import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso e Política de Privacidade — Coffee & Beats",
};

function Secao({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-8">
      <h2 className="text-base font-extrabold text-cb-marrom mb-3 pb-2 border-b border-cb-marrom/10">
        {titulo}
      </h2>
      <div className="text-cb-marrom/70 text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

export default function TermosPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-10 h-10 object-contain" />
        <h1 className="text-xl font-extrabold text-cb-marrom">Coffee &amp; Beats</h1>
      </div>
      <p className="text-2xl font-extrabold text-cb-marrom mb-1">
        Termos de Uso e Política de Privacidade
      </p>
      <p className="text-cb-marrom/40 text-xs mb-8">Última atualização: junho de 2025</p>

      <Secao titulo="1. Aceitação dos Termos">
        <p>
          Ao utilizar o portal web do Coffee &amp; Beats para realizar pedidos, reservas de mesa ou
          consultar o cardápio, você declara ter lido, compreendido e concordado com os presentes
          Termos de Uso e com a Política de Privacidade descrita neste documento.
        </p>
        <p>
          Caso não concorde com alguma das condições, solicitamos que não utilize nossos serviços
          digitais. O atendimento presencial continua disponível normalmente em nosso estabelecimento.
        </p>
      </Secao>

      <Secao titulo="2. Descrição do Serviço">
        <p>
          O portal web do Coffee &amp; Beats é um canal digital complementar ao atendimento presencial.
          Por meio dele, clientes cadastrados podem:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Consultar o cardápio atualizado com preços e descrições;</li>
          <li>Realizar pedidos antecipados para retirada no balcão;</li>
          <li>Acompanhar o status do pedido em tempo real;</li>
          <li>Gerenciar comandas abertas em mesa;</li>
          <li>Agendar reservas de mesa.</li>
        </ul>
        <p>
          O Coffee &amp; Beats não realiza entregas (delivery) por este canal. O pagamento é sempre
          efetuado de forma presencial no estabelecimento, no momento da retirada ou ao encerrar a comanda.
        </p>
      </Secao>

      <Secao titulo="3. Cadastro e Responsabilidade do Usuário">
        <p>
          Para utilizar o portal, é necessário criar uma conta com email e senha, ou autenticar-se
          via Google. O usuário é responsável por manter a confidencialidade de suas credenciais de
          acesso e por todas as ações realizadas em sua conta.
        </p>
        <p>
          Informações fornecidas no cadastro devem ser verdadeiras e atualizadas. O Coffee &amp; Beats
          reserva-se o direito de suspender contas com dados incorretos ou utilizadas de forma abusiva.
        </p>
      </Secao>

      <Secao titulo="4. Política de Cancelamento e Alterações">
        <p>
          Pedidos realizados pelo portal entram imediatamente em preparo após confirmação. Por isso:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong>Cancelamentos</strong> somente são aceitos <strong>antes</strong> do início do
            preparo. Após o status mudar para "Em preparo", o pedido não pode ser cancelado remotamente.
          </li>
          <li>
            Para cancelamentos após o início do preparo, o cliente deve dirigir-se ao balcão.
            A aceitação fica a critério da equipe, conforme o estágio de produção.
          </li>
          <li>
            <strong>Reservas de mesa</strong> podem ser canceladas a qualquer momento diretamente pelo portal,
            desde que realizadas com pelo menos 1 hora de antecedência.
          </li>
        </ul>
        <p>
          O Coffee &amp; Beats não realiza estornos financeiros por este canal, pois o pagamento é
          presencial. Em caso de divergência, o cliente deve solicitar o cancelamento no caixa.
        </p>
      </Secao>

      <Secao titulo="5. Disponibilidade e Cardápio">
        <p>
          O cardápio e os preços exibidos no portal refletem o cardápio vigente, mas podem ser
          alterados sem aviso prévio. A disponibilidade dos produtos está sujeita ao estoque do dia.
          Em caso de indisponibilidade após o pedido, a equipe entrará em contato via WhatsApp ou
          informará pessoalmente.
        </p>
      </Secao>

      <Secao id="privacidade" titulo="6. Política de Privacidade — Dados Coletados">
        <p>Para viabilizar o serviço, coletamos os seguintes dados pessoais:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li><strong>Nome completo:</strong> para identificação nos pedidos e reservas;</li>
          <li><strong>Endereço de email:</strong> para autenticação e comunicações sobre o pedido;</li>
          <li><strong>Número de WhatsApp:</strong> para notificações sobre status do pedido e confirmação de reservas;</li>
          <li><strong>Histórico de pedidos:</strong> para facilitar novos pedidos e gerar estatísticas de consumo;</li>
          <li><strong>Dados de uso:</strong> páginas acessadas e interações no portal, para melhoria contínua do serviço.</li>
        </ul>
      </Secao>

      <Secao titulo="7. Uso e Compartilhamento dos Dados">
        <p>
          Seus dados são utilizados exclusivamente para a prestação do serviço descrito neste documento.
          Não vendemos, alugamos nem compartilhamos suas informações pessoais com terceiros para fins
          comerciais, exceto:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>
            <strong>Supabase (infraestrutura):</strong> os dados são armazenados em servidores seguros
            fornecidos pela Supabase Inc., com sede nos EUA, em conformidade com as normas internacionais
            de proteção de dados;
          </li>
          <li>
            <strong>Obrigação legal:</strong> quando exigido por autoridade competente.
          </li>
        </ul>
      </Secao>

      <Secao titulo="8. Retenção e Exclusão de Dados">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a exclusão da sua
          conta e de todos os dados associados a qualquer momento, enviando um email para o contato
          do estabelecimento. A exclusão será processada em até 30 dias, respeitadas eventuais
          obrigações legais de retenção.
        </p>
      </Secao>

      <Secao titulo="9. Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não
          autorizado, perda ou destruição. Senhas são armazenadas com criptografia e nunca acessadas
          pela equipe. Conexões são realizadas via HTTPS.
        </p>
      </Secao>

      <Secao titulo="10. Alterações neste Documento">
        <p>
          O Coffee &amp; Beats pode atualizar estes Termos periodicamente. A versão vigente estará
          sempre disponível nesta página. O uso continuado do portal após alterações implica na
          aceitação dos novos termos.
        </p>
      </Secao>

      <Secao titulo="11. Contato">
        <p>
          Dúvidas, solicitações ou reclamações relacionadas a este documento podem ser encaminhadas
          diretamente ao estabelecimento, presencialmente ou pelos canais de atendimento disponíveis
          no local.
        </p>
      </Secao>

      <div className="mt-10 pt-6 border-t border-cb-marrom/10 flex justify-between items-center">
        <p className="text-cb-marrom/30 text-xs">© 2025 Coffee &amp; Beats. Todos os direitos reservados.</p>
        <Link
          href="/web/login"
          className="text-cb-amber text-xs hover:underline"
        >
          ← Voltar ao login
        </Link>
      </div>
    </div>
  );
}
