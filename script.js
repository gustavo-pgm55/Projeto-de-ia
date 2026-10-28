
let usuarioAtual = null;
let comprovantes = [];
let modoAuth = "cadastro";
let processandoFoto = false;
let graficoCategorias = null;

const BUCKET_IMAGENS = "comprovante";
const TABELA_COMPROVANTES = "comprovantes";

// Elementos da página
const $ = (seletor) => document.querySelector(seletor);

// Mensagens na tela de autenticação
function mostrarStatus(mensagem, erro = false) {
  const status = $("#status-auth");

  if (status) {
    status.textContent = mensagem;
    status.style.color = erro ? "#b91c1c" : "";
  }
}
// Atualizar os textos da tela de autenticação
function atualizarModoAuth() {
  const titulo = $("#titulo-auth");
  const mensagem = $("#mensagem-auth");
  const botao = $("#botao-auth");
  const alternar = $("#alternar-auth");
  const senha = $("#senha");

  if (titulo) {
    titulo.textContent =
      modoAuth === "cadastro" ? "Criar conta" : "Entrar na conta";
  }

  if (mensagem) {
    mensagem.textContent =
      modoAuth === "cadastro"
        ? "Cadastre seu e-mail e crie uma senha."
        : "Digite seu e-mail e sua senha para entrar.";
  }

  if (botao) {
    botao.textContent =
      modoAuth === "cadastro" ? "Criar conta" : "Entrar";
  }

  if (alternar) {
    alternar.textContent =
      modoAuth === "cadastro"
        ? "Já tenho uma conta — entrar"
        : "Ainda não tenho conta — cadastrar";
  }

  if (senha) {
    senha.autocomplete =
      modoAuth === "cadastro" ? "new-password" : "current-password";

    senha.minLength = modoAuth === "cadastro" ? 6 : 1;
  }

  mostrarStatus("");
}

// Cadastro
async function cadastrar() {
  const email = $("#email")?.value.trim();
  const senha = $("#senha")?.value;

  if (!email || !senha) {
    mostrarStatus("Preencha o e-mail e a senha.", true);
    return;
  }

  const { data, error } = await clienteSupabase.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: "https://html-gamma-coral.vercel.app"
    }
  });

  if (error) {
    mostrarStatus("Erro ao cadastrar: " + error.message, true);
    return;
  }

  if (data.session && data.user) {
    usuarioAtual = data.user;
    await mostrarApp();
    return;
  }

  mostrarStatus(
    "Cadastro realizado! Confira seu e-mail para confirmar a conta."
  );
}

// Login
async function entrar() {
  const email = $("#email")?.value.trim();
  const senha = $("#senha")?.value;

  if (!email || !senha) {
    mostrarStatus("Preencha o e-mail e a senha.", true);
    return;
  }

  const { data, error } = await clienteSupabase.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) {
    mostrarStatus("Erro ao entrar: " + error.message, true);
    return;
  }

  usuarioAtual = data.user;
  await mostrarApp();
}

// Sair
async function sair() {
  const { error } = await clienteSupabase.auth.signOut();

  if (error) {
    mostrarStatus("Erro ao sair: " + error.message, true);
    return;
  }

  usuarioAtual = null;
  comprovantes = [];

  await mostrarApp();
}

// Mostrar a tela correta conforme a autenticação
async function mostrarApp() {
  const telaAuth = $("#tela-auth");
  const app = $("#app");
  const usuarioLogado = $("#usuario-logado");

  if (!usuarioAtual) {
    if (app) app.hidden = true;
    if (telaAuth) telaAuth.hidden = false;
    if (usuarioLogado) usuarioLogado.textContent = "";

    atualizarLista();
    return;
  }

  if (telaAuth) telaAuth.hidden = true;
  if (app) app.hidden = false;

  if (usuarioLogado) {
    usuarioLogado.textContent = usuarioAtual.email || "";
  }

  await carregarComprovantes();
}

// Verificar sessão ao abrir a página
async function iniciarAplicativo() {
  const telaAuth = $("#tela-auth");
  const app = $("#app");

  if (app) app.hidden = true;
  if (telaAuth) telaAuth.hidden = false;

  const { data, error } = await clienteSupabase.auth.getSession();

  if (error) {
    console.error("Erro ao verificar sessão:", error);
    mostrarStatus("Não foi possível verificar sua sessão.", true);
    return;
  }

  usuarioAtual = data.session?.user || null;

  await mostrarApp();
}

// Carregar os comprovantes do usuário
async function carregarComprovantes() {
  if (!usuarioAtual) {
    comprovantes = [];
    atualizarLista();
    return;
  }

  const { data, error } = await clienteSupabase
    .from(TABELA_COMPROVANTES)
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("Erro ao carregar comprovantes:", error);
    mostrarMensagemApp("Erro ao carregar comprovantes: " + error.message);
    return;
  }

  comprovantes = data || [];
  atualizarLista();
}

// Mensagens gerais do aplicativo
function mostrarMensagemApp(mensagem) {
  alert(mensagem);
}

// Formatar valores em reais
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

// Atualizar total e lista
function atualizarLista() {
  const lista = $(".lista");
  const totalElemento = $(".total");

  const total = comprovantes.reduce(
    (soma, item) => soma + Number(item.valor_total || 0),
    0
  );


  if (totalElemento) {
    totalElemento.textContent = formatarMoeda(total);
  }

  // Atualizar o gráfico sempre que a lista mudar.
  atualizarGraficoCategorias();

  if (!lista) return;


  lista.replaceChildren();

  if (comprovantes.length === 0) {
    const vazio = document.createElement("p");
    vazio.textContent = "Nenhum comprovante salvo ainda.";
    lista.appendChild(vazio);
    return;
  }

  for (const item of comprovantes) {
    const cartao = document.createElement("article");
    cartao.className = "comprovante";

    const titulo = document.createElement("h3");
    titulo.textContent =
      item.estabelecimento || "Estabelecimento não identificado";

    const categoria = document.createElement("p");
    categoria.textContent = item.categoria || "📄 Outros";

    const valor = document.createElement("p");
    valor.textContent = formatarMoeda(item.valor_total);

    const data = document.createElement("p");
    data.textContent = item.data_compra
      ? new Date(item.data_compra + "T12:00:00").toLocaleDateString("pt-BR")
      : "";

    cartao.append(titulo, categoria, valor, data);

    const tituloItens = document.createElement("h4");
    tituloItens.textContent = "🛒 Itens da compra";
    cartao.appendChild(tituloItens);

    const listaItens = document.createElement("ul");

    for (const produto of (Array.isArray(item.itens) ? item.itens : [])) {
      const linha = document.createElement("li");

      const quantidade = produto.quantidade;
      const totalItem = produto.valor_total;

      const quantidadeTexto =
        quantidade != null && Number.isFinite(Number(quantidade))
          ? quantidade
          : "—";

      const totalTexto =
        totalItem != null && Number.isFinite(Number(totalItem))
          ? formatarMoeda(Number(totalItem))
          : "Não identificado";

      linha.textContent =
        `${produto.nome || "Produto não identificado"} — ` +
        `Qtd.: ${quantidadeTexto} — Total: ${totalTexto}`;

      listaItens.appendChild(linha);
    }

    if (listaItens.children.length > 0) {
      cartao.appendChild(listaItens);
    } else {
      const semItens = document.createElement("p");
      semItens.textContent = "Nenhum item identificado.";
      cartao.appendChild(semItens);
    }


    if (item.imagem_path) {
      const botaoImagem = document.createElement("button");
      botaoImagem.type = "button";
      botaoImagem.textContent = "Ver comprovante";

      botaoImagem.addEventListener("click", () => {
        abrirImagem(item.imagem_path);
      });

      cartao.appendChild(botaoImagem);
    }

    lista.appendChild(cartao);
  }
}

// Abrir imagem privada por link temporário
async function abrirImagem(caminho) {
  console.log("Caminho da imagem:", caminho);
  const { data, error } = await clienteSupabase.storage
    .from(BUCKET_IMAGENS)
    .createSignedUrl(caminho, 60);

 if (error) {
  console.error("Erro detalhado do Supabase:", error);
  console.log("Caminho solicitado:", caminho);
  console.log("Bucket utilizado:", BUCKET_IMAGENS);

  mostrarMensagemApp("Erro ao abrir imagem: " + error.message);
  return;
}

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

// Ler e salvar um comprovante
async function lerfoto(evento) {
  if (processandoFoto) return;

  const campoFoto = evento?.target || $("#foto");
  const foto = campoFoto?.files?.[0];

  if (!foto) return;

  if (!usuarioAtual) {
    mostrarMensagemApp("Entre na sua conta antes de enviar um comprovante.");
    campoFoto.value = "";
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type)) {
    mostrarMensagemApp("Use uma imagem JPG, PNG ou WEBP.");
    campoFoto.value = "";
    return;
  }

  if (foto.size > 5 * 1024 * 1024) {
    mostrarMensagemApp("A imagem deve ter no máximo 5 MB.");
    campoFoto.value = "";
    return;
  }

  if (!window.puter?.ai?.chat) {
    mostrarMensagemApp(
      "A IA não carregou. Atualize a página e tente novamente."
    );
    return;
  }

  processandoFoto = true;
  campoFoto.disabled = true;

  let caminhoImagem = null;
  let imagemEnviada = false;
  let registroSalvo = false;

  try {
    const pedido = `
Analise cuidadosamente a imagem anexada. Ela é um comprovante de pagamento,
recibo ou nota fiscal.

Leia os dados diretamente da imagem. Não use informações presumidas.

Extraia:
1. O nome do estabelecimento que emitiu o comprovante.
2. O valor TOTAL efetivamente pago ou o total final da compra.
3. A categoria da despesa.
4. A data da compra ou do pagamento.

ATENÇÃO AO VALOR:
- Procure expressões como "TOTAL", "VALOR TOTAL", "TOTAL A PAGAR"
  ou "VALOR PAGO".
- Não confunda o valor total com troco, subtotal, parcelas ou valor de itens.
- Preserve os centavos.
- Converta o valor para número usando ponto decimal.
- Exemplo: R$ 125,90 deve ser 125.90.
- Se o valor não puder ser lido com segurança, use null.
- Nunca invente um valor.

CATEGORIAS possíveis:
🍔 Alimentação
🚗 Transporte
🛒 Compras
💊 Saúde
🏠 Moradia
📚 Educação
🎮 Lazer
💡 Contas
📄 Outros


REGRAS IMPORTANTES PARA CLASSIFICAR:
- Lanches, salgados, hambúrgueres, sanduíches, refrigerantes,
  doces, refeições e alimentos devem ser classificados como
  "🍔 Alimentação".
- Compras de supermercado que sejam principalmente alimentos
  também devem ser classificadas como "🍔 Alimentação".
- Roupas, eletrônicos e outros produtos não alimentícios devem
  ser classificados como "🛒 Compras".
- Não classifique uma despesa como "🛒 Compras" apenas porque
  houve uma compra. Considere o produto ou serviço adquirido.


Responda somente com um objeto JSON válido, sem markdown,
sem comentários e sem texto antes ou depois.

Use exatamente esta estrutura:
{
  "estabelecimento": "nome lido na imagem ou Não identificado",
  "valor_total": 125.90,
  "categoria": "🍔 Alimentação",
  "data_compra": "2026-10-19"
}

A data deve estar no formato AAAA-MM-DD.
Se não conseguir identificar a data, use uma string vazia.
Se não conseguir identificar o valor total, use null.
`;

    mostrarMensagemApp("Lendo o comprovante. Aguarde...");

    console.log("Arquivo enviado para a IA:", {
      nome: foto.name,
      tipo: foto.type,
      tamanho: foto.size
    });


    // ETAPA 1: Extrair o texto diretamente da imagem.
    if (!window.puter.ai.img2txt) {
      throw new Error("A função de leitura de imagens não está disponível.");
    }

    const textoImagem = await window.puter.ai.img2txt(foto);

    console.log("Texto extraído da imagem:", textoImagem);

    if (!textoImagem || !String(textoImagem).trim()) {
      throw new Error(
        "Não foi possível ler o texto da imagem. Tente uma foto mais nítida."
      );
    }

    // ETAPA 2: Organizar o texto reconhecido em JSON.

    const pedidoEstruturado = `
Analise o texto extraído de um comprovante de compra e retorne
somente um objeto JSON válido, sem markdown e sem explicações.

O JSON deve seguir esta estrutura:
    {
      "estabelecimento": "nome do estabelecimento ou null",
        "valor_total": 43.00,
          "categoria": "🍔 Alimentação",
            "data_compra": "2018-03-28",
              "itens": [
                {
                  "nome": "CERVEJA LONGNECK",
                  "quantidade": 1,
                  "valor_unitario": 6.00,
                  "valor_total": 6.00
                }
              ]
    }

    REGRAS:
    - Extraia todos os produtos que conseguir identificar.
- Para cada produto, informe nome, quantidade, valor unitário e valor total.
- Não invente informações que não estejam no texto.
- Se uma informação de um produto não estiver disponível, use null.
- valor_total deve ser o total final da compra, não a soma estimada pela IA.
- Se o valor total não estiver identificado, use null.
- A data deve estar no formato AAAA - MM - DD.
- Se a data não estiver identificada, use null.
- A categoria deve corresponder ao tipo de compra.
- Se nenhum produto for identificado, retorne "itens": [].

TEXTO EXTRAÍDO DO COMPROVANTE:
${textoImagem}
    `;


    const resposta = await window.puter.ai.chat(pedidoEstruturado);

    console.log("Resposta completa do Puter:", resposta);

    let conteudo = typeof resposta === "string"
      ? resposta
      : resposta?.message?.content ?? resposta?.text ?? "";

    if (Array.isArray(conteudo)) {
      conteudo = conteudo
        .map(parte => typeof parte === "string" ? parte : parte?.text || "")
        .join("\n");
    }

    const texto = String(conteudo)
      .replace(/```(?: json) ?/gi, "")
      .trim();

    console.log("Texto extraído da IA:", texto);

    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");

    if (inicio < 0 || fim < inicio) {
      throw new Error("A IA não retornou um JSON válido.");
    }

    let dados;

    try {
      dados = JSON.parse(texto.slice(inicio, fim + 1));
    } catch {
      throw new Error("Não consegui interpretar os dados retornados pela IA.");
    }

    console.log("Dados identificados pela IA:", dados);


    // Validar o valor antes de salvar.
    // Number(null) resulta em 0, por isso null deve ser rejeitado primeiro.
    if (
      dados.valor_total === null ||
      dados.valor_total === undefined ||
      dados.valor_total === ""
    ) {
      throw new Error(
        "A IA não identificou o valor total. Verifique a imagem e tente novamente."
      );
    }

    let valor;

    if (typeof dados.valor_total === "number") {
      valor = dados.valor_total;
    } else if (typeof dados.valor_total === "string") {
      const valorTexto = dados.valor_total
        .trim()
        .replace(/^R\$\s*/i, "")
        .replace(/\s/g, "");

      // Aceitar formatos numéricos comuns, como 125.90 ou 125,90.
      if (/^\d+,\d{1,2}$/.test(valorTexto)) {
        valor = Number(valorTexto.replace(",", "."));
      } else if (/^\d+(\.\d{1,2})?$/.test(valorTexto)) {
        valor = Number(valorTexto);
      } else {
        throw new Error("A IA retornou um valor em formato inválido.");
      }
    } else {
      throw new Error("A IA retornou um valor em formato inválido.");
    }

    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error("O valor total identificado não é válido.");
    }

    const extensoes = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };

    caminhoImagem =
      `${usuarioAtual.id}/${crypto.randomUUID()}.${extensoes[foto.type]}`;

    // Enviar imagem para o bucket privado.
    const { error: erroUpload } = await clienteSupabase.storage
      .from(BUCKET_IMAGENS)
      .upload(caminhoImagem, foto, {
        contentType: foto.type,
        upsert: false
      });

    if (erroUpload) throw erroUpload;
    imagemEnviada = true;

    // Usar a data local atual como alternativa se a IA não identificar a data.
    const agora = new Date();

    const dataHoje =
      `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;

    const dataRecebida = String(dados.data_compra || "");
    const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(dataRecebida);

    const dataCompra = dataValida ? dataRecebida : dataHoje;

    // Evitar campos vazios no registro.
    const estabelecimento =
      typeof dados.estabelecimento === "string" &&
        dados.estabelecimento.trim()
        ? dados.estabelecimento.trim()
        : "Não identificado";

    const categoria =
      typeof dados.categoria === "string" && dados.categoria.trim()
        ? dados.categoria.trim()
        : "📄 Outros";

    const registro = {
      user_id: usuarioAtual.id,
      data_compra: dataCompra,
      estabelecimento,
      valor_total: valor,
      categoria,
      imagem_path: caminhoImagem,
      itens: Array.isArray(dados.itens) ? dados.itens : []
    };
    // Salvar no banco.
    const { error: erroBanco } = await clienteSupabase
      .from(TABELA_COMPROVANTES)
      .insert(registro);

    if (erroBanco) throw erroBanco;

    registroSalvo = true;
    campoFoto.value = "";

    await carregarComprovantes();

    mostrarMensagemApp(
      `Comprovante salvo com sucesso!\n\n` +
      `Estabelecimento: ${estabelecimento}\n` +
      `Valor: ${formatarMoeda(valor)}\n` +
      `Categoria: ${categoria}\n` +
      `Data: ${new Date(dataCompra + "T12:00:00").toLocaleDateString("pt-BR")}`
    );
  } catch (erro) {
    console.error("Erro ao processar comprovante:", erro);

    // Remover a imagem caso o upload tenha ocorrido,
    // mas o registro no banco tenha falhado.
    if (imagemEnviada && !registroSalvo && caminhoImagem) {
      const { error: erroRemocao } = await clienteSupabase.storage
        .from(BUCKET_IMAGENS)
        .remove([caminhoImagem]);

      if (erroRemocao) {
        console.error("Erro ao remover imagem:", erroRemocao);
      }
    }

    mostrarMensagemApp(
      "Não foi possível processar o comprovante:\n" +
      (erro.message || String(erro))
    );
  } finally {
    processandoFoto = false;
    campoFoto.disabled = false;
  }
}

// Configurar os eventos da página uma única vez
function configurarEventos() {
  const formulario = $("#form-auth");
  const alternar = $("#alternar-auth");
  const botaoSair = $("#botao-sair");
  const campoFoto = $("#foto");

  if (alternar) {
    alternar.addEventListener("click", () => {
      modoAuth = modoAuth === "cadastro" ? "login" : "cadastro";
      atualizarModoAuth();
    });
  }

  if (formulario) {
    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const botao = $("#botao-auth");
      if (botao) botao.disabled = true;

      mostrarStatus("Aguarde...");

      try {
        if (modoAuth === "cadastro") {
          await cadastrar();
        } else {
          await entrar();
        }
      } catch (erro) {
        console.error("Erro na autenticação:", erro);

        mostrarStatus(
          "Erro: " + (erro.message || String(erro)),
          true
        );
      } finally {
        if (botao) botao.disabled = false;
      }
    });
  }

  if (botaoSair) {
    botaoSair.addEventListener("click", sair);
  }

  if (campoFoto) {
    campoFoto.addEventListener("change", lerfoto);
  }
}

// Inicialização
document.addEventListener("DOMContentLoaded", async () => {
  configurarEventos();
  atualizarModoAuth();
  await iniciarAplicativo();
});

// Atualizar o estado quando a autenticação mudar
clienteSupabase.auth.onAuthStateChange((evento, sessao) => {
  if (evento === "SIGNED_OUT") {
    usuarioAtual = null;
    comprovantes = [];

    const app = $("#app");
    const telaAuth = $("#tela-auth");

    if (app) app.hidden = true;
    if (telaAuth) telaAuth.hidden = false;

    atualizarLista();
  } else if (evento === "SIGNED_IN" && sessao?.user) {
    usuarioAtual = sessao.user;
  }
});

function atualizarGraficoCategorias() {
  console.log("A função do gráfico foi executada!");

  const canvas = document.querySelector("#canvas-categorias");
  const mensagem = document.querySelector("#mensagem-grafico");

  if (!canvas || !window.Chart) {
    console.error("Canvas ou biblioteca Chart.js não encontrados.");
    return;
  }
  const totaisPorCategoria = {};

  comprovantes.forEach(function (comprovante) {
    const categoria = comprovante.categoria || "Outros";
    const valor = Number(comprovante.valor_total || 0);

    totaisPorCategoria[categoria] =
      (totaisPorCategoria[categoria] || 0) + valor;
  });

  const categorias = Object.keys(totaisPorCategoria);
  const valores = Object.values(totaisPorCategoria);
  console.log("Comprovantes:", comprovantes);
  console.log("Categorias:", categorias);
  console.log("Valores:", valores);
  if (graficoCategorias) {
    graficoCategorias.destroy();
    graficoCategorias = null;
  }

  if (categorias.length === 0) {
    mensagem.textContent = "Envie um comprovante para visualizar seus gastos por categoria.";
    return;
  }

  mensagem.textContent = "";

  graficoCategorias = new Chart(canvas, {
    type: "doughnut",

    data: {
      labels: categorias,
      datasets: [{
        label: "Gastos por categoria",
        data: valores
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: "bottom"
        },

        tooltip: {
          callbacks: {
            label: function (context) {
              return context.label + ": " +
                Number(context.raw).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                });
            }
          }
        }
      }
    }
  });
}

