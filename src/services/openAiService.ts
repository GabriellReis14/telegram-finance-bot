import axios from "axios";
import { getToday } from "../utils/dateUtils";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function callOpenAI(prompt: string): Promise<string> {
  const response = await axios.post(
    OPENAI_URL,
    {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );
  const content = response.data.choices[0].message.content;
  return content.replace(/```json|```/g, "").trim();
}

export async function detectIntent(text: string): Promise<IntentDetectionResponse> {
  const prompt = `
    Hoje é ${getToday()}.

    Você é um classificador de mensagens para um bot financeiro.

    Analise a seguinte frase:

    "${text}"

    Sua tarefa é identificar o tipo de mensagem e retornar um JSON com o campo "type".

    O texto pode ser um ocr de um recibo, uma mensagem do usuário ou uma frase qualquer.

    Se você detectar que foi de um ocr, como "comprovante de pagamento", "recibo", "nota fiscal", etc, considere que é um lançamento financeiro

    E retorne um JSON com um campo "type", de acordo com as regras abaixo:

    - Se for um lançamento de gasto ou despesa: { "type": "expense" }
    - Se for um lançamento de receita ou recebimento: { "type": "income" }
    - Se for uma consulta de quanto gastou ou recebeu: { "type": "query" }
    - Se o usuário estiver tentando se cadastrar, informando e-mail ou dizendo frases como "meu email é", "quero me cadastrar", "cadastrar": { "type": "registration" }
    - Se for qualquer outra coisa que não seja sobre finanças ou cadastro: { "type": "other" }

    Responda apenas o JSON puro, sem comentários.
    `;

  return JSON.parse(await callOpenAI(prompt));
}

export async function analyzeExpense(text: string): Promise<ExpenseAnalysisResponse> {
  const prompt = `
    Hoje é ${getToday()}.

    Você é um classificador de lançamentos financeiros.

    Analise a seguinte frase:

    "${text}"

    O texto pode ser um ocr de um recibo, uma mensagem do usuário ou uma frase qualquer.

    Se for uma ocr de um recibo, como "comprovante de pagamento", "recibo", "nota fiscal", etc, considere que é um lançamento financeiro e 
    coloque na categoria como Transferência ou Outros, dependendo do contexto.
    
    Atente-se aos detalhes e ignore erros de digitação ou formatação.

    Sua tarefa é identificar os seguintes campos:

    - valor (amount): número em reais
    - forma de pagamento (payment_method): (pix, debit, credit, cash, other)
    - categoria macro (macro_category): Exemplo: Receita, Despesa Fixa, Variável, Lazer, etc
    - categoria detalhada (detailed_category): Exemplo: Mercado, Restaurante, Salário, Venda, etc
    - data (date): formato YYYY-MM-DD HH:mm:ss (Se caso o usuário não informar a data, use a data de hoje e o horário de hoje)
    - tipo (type): "expense" para gastos ou "income" para entradas de dinheiro (exemplo: salário, vendas, recebimentos)

    Se for um lançamento válido, responda:

    {
      "success": true,
      "data": {
        "amount": (número),
        "payment_method": (pix, debit, credit, cash, other),
        "macro_category": (ex: Receita ou Variável),
        "detailed_category": (ex: Salário ou Restaurante),
        "date": (YYYY-MM-DD HH:mm:ss),
        "type": (income ou expense)
      }
    }

    Se a frase não for um lançamento financeiro, retorne:

    {
      "success": false,
      "message": "Não consegui identificar um lançamento válido."
    }

    Responda apenas o JSON puro.
    `;

  return JSON.parse(await callOpenAI(prompt));
}

export async function analyzeQuery(text: string): Promise<QueryAnalysisResponse> {
  const today = getToday();
  const prompt = `
    Hoje é ${today}.

    Sua tarefa é analisar a frase a seguir e determinar o intervalo de datas que o usuário deseja consultar os gastos.

    Frase: "${text}"

    Instruções:

    1. Se a frase for sobre "hoje", "ontem", "amanhã", ou qualquer outro dia único → retorne o mesmo valor para start_date e end_date.

    2. Se for "este mês", "mês passado", "ano passado", "últimos 3 meses", "último semestre", etc → calcule o intervalo corretamente.

    3. Se for uma frase ambígua ou que não fale de período → retorne success: false.

    Formato de resposta:

    Se conseguir identificar:

    {
      "success": true,
      "data": {
        "start_date": "YYYY-MM-DD HH:mm:ss",
        "end_date": "YYYY-MM-DD HH:mm:ss"
      }
    }

    Se a frase não for uma consulta de período, retorne:

    {
      "success": false,
      "message": "Frase não corresponde a uma consulta de período."
    }

    Responda apenas o JSON puro, sem blocos de código, sem comentários, sem formatação adicional.`;

  return JSON.parse(await callOpenAI(prompt));
}
