import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // Empresa
  const empresa = await prisma.empresa.upsert({
    where: { slug: "coffee-beats" },
    update: {},
    create: {
      nome: "Coffee & Beats",
      slug: "coffee-beats",
      corPrimaria: "#C8853A",
      corSecundaria: "#1A0A00",
    },
  });

  console.log(`✅ Empresa: ${empresa.nome} (${empresa.id})`);

  // Configuração inicial
  await prisma.configuracao.upsert({
    where: { empresaId: empresa.id },
    update: {},
    create: {
      empresaId: empresa.id,
      prefixoSenha: "CB",
      senhaAtual: 100,
      tempoMedioMinutos: 5,
      mensagemEspera: "Seu pedido está sendo preparado com carinho ☕",
    },
  });

  // Categorias
  const categoriasData = [
    { nome: "Cafés", emoji: "☕", ordem: 1 },
    { nome: "Bebidas Geladas", emoji: "🥤", ordem: 2 },
    { nome: "Bolos", emoji: "🍰", ordem: 3 },
    { nome: "Salgados", emoji: "🥐", ordem: 4 },
    { nome: "Sobremesas", emoji: "🍫", ordem: 5 },
    { nome: "Combos", emoji: "🎁", ordem: 6 },
  ];

  const categorias: Record<string, string> = {};
  for (const cat of categoriasData) {
    const c = await prisma.categoria.upsert({
      where: { id: `cat-${cat.nome.toLowerCase().replace(/\s/g, "-")}-${empresa.id}` },
      update: {},
      create: {
        id: `cat-${cat.nome.toLowerCase().replace(/\s/g, "-")}-${empresa.id}`,
        empresaId: empresa.id,
        ...cat,
      },
    });
    categorias[cat.nome] = c.id;
  }

  console.log(`✅ ${categoriasData.length} categorias criadas`);

  // Adicionais
  const adicionaisData = [
    { nome: "Leite sem lactose", preco: 2.0 },
    { nome: "Leite de aveia", preco: 4.0 },
    { nome: "Leite de amêndoas", preco: 5.0 },
    { nome: "Chantilly", preco: 3.0 },
    { nome: "Canela", preco: 0.0 },
    { nome: "Calda de caramelo", preco: 2.5 },
    { nome: "Shot extra de espresso", preco: 4.0 },
    { nome: "Mel", preco: 1.5 },
  ];

  const adicionais: Record<string, string> = {};
  for (const add of adicionaisData) {
    const a = await prisma.adicional.upsert({
      where: { id: `add-${add.nome.toLowerCase().replace(/\s/g, "-")}-${empresa.id}` },
      update: {},
      create: {
        id: `add-${add.nome.toLowerCase().replace(/\s/g, "-")}-${empresa.id}`,
        empresaId: empresa.id,
        ...add,
      },
    });
    adicionais[add.nome] = a.id;
  }

  console.log(`✅ ${adicionaisData.length} adicionais criados`);

  // Produtos
  const produtosData = [
    // Cafés
    {
      categoriaId: categorias["Cafés"],
      nome: "Espresso Clássico",
      descricao: "Dose perfeita de café concentrado, extraído com pressão ideal para um sabor intenso e encorpado.",
      preco: 8.0,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400",
      adicionais: ["Canela", "Shot extra de espresso"],
    },
    {
      categoriaId: categorias["Cafés"],
      nome: "Cappuccino Tradicional",
      descricao: "Espresso encorpado com leite vaporizado e espuma cremosa, finalizado com canela.",
      preco: 14.9,
      destaque: true,
      fotoUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400",
      adicionais: ["Leite sem lactose", "Leite de aveia", "Chantilly", "Canela"],
    },
    {
      categoriaId: categorias["Cafés"],
      nome: "Latte Caramel",
      descricao: "Espresso suave com leite vaporizado e calda de caramelo artesanal. Um abraço em forma de café.",
      preco: 17.9,
      destaque: true,
      fotoUrl: "https://images.unsplash.com/photo-1561047029-3000c68339ca?w=400",
      adicionais: ["Leite de aveia", "Leite de amêndoas", "Calda de caramelo", "Chantilly"],
    },
    {
      categoriaId: categorias["Cafés"],
      nome: "Americano",
      descricao: "Espresso alongado com água quente, sabor equilibrado e suave. Clássico sem frescura.",
      preco: 10.0,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400",
      adicionais: ["Shot extra de espresso", "Mel"],
    },
    {
      categoriaId: categorias["Cafés"],
      nome: "Macchiato de Baunilha",
      descricao: "Espresso marcado com leve camada de espuma e toque de baunilha. Elegante e aromático.",
      preco: 15.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400",
      adicionais: ["Leite sem lactose", "Chantilly"],
    },

    // Bebidas Geladas
    {
      categoriaId: categorias["Bebidas Geladas"],
      nome: "Cold Brew",
      descricao: "Café extraído a frio por 12 horas. Suave, aveludado e naturalmente doce. Servido sobre gelo.",
      preco: 16.9,
      destaque: true,
      fotoUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400",
      adicionais: ["Leite de aveia", "Leite de amêndoas", "Calda de caramelo"],
    },
    {
      categoriaId: categorias["Bebidas Geladas"],
      nome: "Frappuccino Caramel",
      descricao: "Café gelado batido com leite, caramelo e gelo. Finalizado com chantilly e calda.",
      preco: 19.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400",
      adicionais: ["Chantilly", "Calda de caramelo"],
    },
    {
      categoriaId: categorias["Bebidas Geladas"],
      nome: "Limonada com Espresso",
      descricao: "Combinação surpreendente de limonada fresca com shot de espresso. Refrescante e energético.",
      preco: 17.5,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400",
      adicionais: ["Shot extra de espresso", "Mel"],
    },

    // Bolos
    {
      categoriaId: categorias["Bolos"],
      nome: "Bolo de Cenoura",
      descricao: "Fofinho por dentro, cobertura de ganache de chocolate. Receita da vovó, sabor da infância.",
      preco: 12.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=400",
      adicionais: [],
    },
    {
      categoriaId: categorias["Bolos"],
      nome: "Cheesecake de Frutas Vermelhas",
      descricao: "Base crocante de biscoito, recheio cremoso de queijo e cobertura de frutas vermelhas frescas.",
      preco: 16.9,
      destaque: true,
      fotoUrl: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400",
      adicionais: [],
    },
    {
      categoriaId: categorias["Bolos"],
      nome: "Brownie Fudge",
      descricao: "Intenso, úmido e com pedaços de chocolate. Para os apaixonados por chocolate amargo.",
      preco: 11.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400",
      adicionais: [],
    },

    // Salgados
    {
      categoriaId: categorias["Salgados"],
      nome: "Croissant de Queijo e Presunto",
      descricao: "Massa folhada amanteigada, recheio generoso de queijo gruyère e presunto artesanal. Assado na hora.",
      preco: 13.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400",
      adicionais: [],
    },
    {
      categoriaId: categorias["Salgados"],
      nome: "Pão de Queijo Premium",
      descricao: "Sequinho por fora, cremoso por dentro. Feito com queijo minas artesanal. Vem em trio.",
      preco: 9.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400",
      adicionais: [],
    },
    {
      categoriaId: categorias["Salgados"],
      nome: "Wrap de Frango Defumado",
      descricao: "Frango defumado, cream cheese, rúcula e tomate seco em tortilla integral. Leve e saboroso.",
      preco: 18.9,
      destaque: true,
      fotoUrl: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400",
      adicionais: [],
    },

    // Sobremesas
    {
      categoriaId: categorias["Sobremesas"],
      nome: "Tiramisù",
      descricao: "Clássico italiano com camadas de mascarpone, biscoito savoiardi e café expresso. Irresistível.",
      preco: 18.9,
      destaque: true,
      fotoUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400",
      adicionais: [],
    },
    {
      categoriaId: categorias["Sobremesas"],
      nome: "Panna Cotta de Caramelo",
      descricao: "Sobremesa italiana aveludada com calda de caramelo salgado. Delicadeza em cada colherada.",
      preco: 14.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=400",
      adicionais: [],
    },
    {
      categoriaId: categorias["Sobremesas"],
      nome: "Waffle Belga",
      descricao: "Waffle crocante por fora, macio por dentro. Servido com gelato de baunilha e calda quente.",
      preco: 21.9,
      destaque: false,
      fotoUrl: "https://images.unsplash.com/photo-1638176066430-b956f7a99ced?w=400",
      adicionais: ["Chantilly", "Calda de caramelo"],
    },

    // Combos
    {
      categoriaId: categorias["Combos"],
      nome: "Combo Manhã",
      descricao: "Cappuccino tradicional + croissant de queijo e presunto. O duo perfeito para começar o dia.",
      preco: 24.9,
      destaque: true,
      fotoUrl: null,
      adicionais: [],
    },
    {
      categoriaId: categorias["Combos"],
      nome: "Combo Tarde Doce",
      descricao: "Latte Caramel + fatia de bolo da casa. Pausa merecida com muito sabor.",
      preco: 27.9,
      destaque: false,
      fotoUrl: null,
      adicionais: [],
    },
  ];

  let totalProdutos = 0;
  for (const prod of produtosData) {
    const { adicionais: addNomes, ...dados } = prod;
    await prisma.produto.upsert({
      where: {
        id: `prod-${dados.nome.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${empresa.id}`,
      },
      update: { fotoUrl: dados.fotoUrl ?? null },
      create: {
        id: `prod-${dados.nome.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${empresa.id}`,
        empresaId: empresa.id,
        ...dados,
        adicionais: {
          create: addNomes
            .filter((n) => adicionais[n])
            .map((n) => ({ adicionalId: adicionais[n] })),
        },
      },
    });
    totalProdutos++;
  }

  console.log(`✅ ${totalProdutos} produtos criados`);

  // Usuários
  const senhaAdmin = await bcrypt.hash("admin123", 10);
  const senhaBarista = await bcrypt.hash("barista123", 10);

  await prisma.usuario.upsert({
    where: { email: "admin@coffeeandbeats.com" },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: "Administrador",
      email: "admin@coffeeandbeats.com",
      senha: senhaAdmin,
      perfil: "ADMIN",
    },
  });

  await prisma.usuario.upsert({
    where: { email: "barista@coffeeandbeats.com" },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: "Barista",
      email: "barista@coffeeandbeats.com",
      senha: senhaBarista,
      perfil: "BARISTA",
    },
  });

  console.log("✅ Usuários criados");
  console.log(`\n🚀 Seed concluído!`);
  console.log(`   Empresa ID: ${empresa.id}`);
  console.log(`   Admin: admin@coffeeandbeats.com / admin123`);
  console.log(`   Barista: barista@coffeeandbeats.com / barista123`);
  console.log(`\n   Adicione no .env:`);
  console.log(`   NEXT_PUBLIC_EMPRESA_ID=${empresa.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
