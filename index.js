const fs = require('fs');
const csv = require('csv-parser');
const { parse, format, getMonth, getYear } = require('date-fns');
const cors = require('cors')
const express = require('express')
const app = express()
// Ler o arquivo CSV
app.use(express.json())
app.use(cors())
app.get('/chart', (req,res) => {
  const data = [];
  fs.createReadStream('modelo-teste-full-stack.xlsx.csv')
    .pipe(csv())
    .on('data', (row) => {
      data.push(row);
    })
    .on('end', () => {
      // Converter datas para o formato apropriado
      data.forEach((row) => {
        if (row['data início']) {
          row['data início'] = format(parse(row['data início'], 'M/d/yy H:mm', new Date()), 'yyyy-MM-dd');
        }

        if (row['data cancelamento']) {
          row['data cancelamento'] = format(parse(row['data cancelamento'], 'M/d/yy H:mm', new Date()), 'yyyy-MM-dd');
        }
      });

      // Calcular MRR e Churn Rate para cada mês
      const monthlyData = {};
      data.forEach((row) => {
        const year = getYear(new Date(row['data início']));
        const month = getMonth(new Date(row['data início'])) + 1; // +1 para corresponder ao mês do JavaScript (janeiro = 0)
        const key = `${year}-${month}`;
        if (!monthlyData[key]) {
          monthlyData[key] = {
            MRR: 0,
            churnRate: 0,
            assinaturasAtivas: 0,
            assinaturasCanceladas: 0,
          };
        }

        const valor = parseFloat(row['valor'].replace(',', '')) || 0;
        const quantidadeCobrancas = parseInt(row['quantidade cobranças']) || 1;
        const mrr = valor * quantidadeCobrancas;

        // Atualizar MRR
        monthlyData[key].MRR += row['periodicidade'] === 'Anual' ? mrr / 12 : mrr;

        // Atualizar contagem de assinaturas ativas e canceladas
        if (row['status'] === 'Ativa' || row['status'] === 'Upgrade') {
          monthlyData[key].assinaturasAtivas++;
        } else if (row['status'] === 'Cancelada' || row['status'] === 'Trial cancelado') {
          monthlyData[key].assinaturasCanceladas++;
        }
      });

      // Calcular Churn Rate para cada mês
      Object.keys(monthlyData).forEach((key) => {
        const { assinaturasAtivas, assinaturasCanceladas } = monthlyData[key];
        monthlyData[key].churnRate = assinaturasCanceladas / assinaturasAtivas;
      });

      // Organizar dados para gráfico MRR
      const monthyData = Object.keys(monthlyData);
      let mrrData = []
      let churnRateData = []

      monthyData.forEach((key) => {
        mrrData.push(monthlyData[key].MRR)
        churnRateData.push(monthlyData[key].churnRate)
      })

      // Preparar objeto para enviar ao front-end
      const combinedData = monthyData.map((label, index) => ({
        date: label,
        mrr: mrrData[index],
        churnRate: churnRateData[index]
      }));

      let labels = []
      let resultMrr = []
      let resultChurnRate = []

      combinedData.forEach(item => {
        labels.push(item.date)
        resultMrr.push(item.mrr)
        resultChurnRate.push(item.churnRate * 100)
      })

      const chartData = {
        mrr: {
          labels: labels,
          data: resultMrr,
        },
        churnRate: {
          labels: labels,
          data: resultChurnRate,
        },
      };
      res.json(chartData)
    });
})

app.listen(3000, () => {
  console.log('Servidor iniciado')
})