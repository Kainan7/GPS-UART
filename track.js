// ===== track.js =====

const fs = require('fs'); // Módulo para ler arquivos do sistema de arquivos
const https = require('https'); // Cria servidor HTTPS
const WebSocket = require('ws'); // Cria e gerencia conexões WebSocket
const SerialPort = require('serialport'); // Comunicação com dispositivos seriais (ex: módulo GPS via UART)
const Readline = require('@serialport/parser-readline'); // Permite ler a entrada serial linha por linha
const express = require('express'); // Framework de servidor web
const path = require('path'); // Manipulação de caminhos de arquivos e diretórios
const app = express(); // Inicializa o aplicativo Express
const { exec } = require('child_process'); // Permite executar comandos no terminal
const axios = require('axios'); // Cliente HTTP para enviar dados ao ThingSpeak

// Lista dos pinos a configurar como UART
const pinsToConfigure = [
    { pin: 'P9_11', mode: 'uart' }, // Pino P9_11
    { pin: 'P9_13', mode: 'uart' }  // Pino P9_13
];

// Função que configura os pinos especificados para modo UART
function configurePins() {
    try {
        for (const pin of pinsToConfigure) {
            const cmd = `config-pin ${pin.pin} ${pin.mode}`; // Comando a ser executado
            executeCommand(cmd)
                .then(() => {
                    console.log(`Pino ${pin.pin} configurado para modo ${pin.mode}`); // Log de sucesso
                })
                .catch((error) => {
                    console.error(`Erro ao configurar o pino:`, error); // Log de erro
                });
        }
    } catch (error) {
        console.error('Erro: ', error); // Erro inesperado
    }
}

// Opções do certificado SSL para conexão HTTPS segura
const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'ca.key')), // Chave privada
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'ca.crt')) // Certificado público
}

// Cria o servidor HTTPS e configura WebSocket
const server = https.createServer(options, app); // Criação do servidor HTTPS
const wss = new WebSocket.Server({ server }); // WebSocket associado ao servidor

// Inicializa a porta serial UART4 com baudrate 9600
const serialPort = new SerialPort('/dev/ttyO4', { baudRate: 9600 }); // Configura UART4
const parser = serialPort.pipe(new Readline({ delimiter: '\r\n' })); // Parser para separar por linha

let lastSentLocation = null; // Última localização enviada (não usado diretamente aqui)
let currentWebSocket = null; // Conexão WebSocket ativa atual

// Evento chamado quando uma conexão WebSocket é estabelecida
wss.on('connection', (socket) => {
    console.log('Conexao WebSocket estabelecida'); // Log de conexão
    currentWebSocket = socket; // Armazena a referência da conexão
});

// Função que lê uma linha da porta serial e extrai latitude/longitude se for uma sentença $GNRMC
function readGPSData() {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Timeout na leitura do GPS")); // Se não receber linha em 5s
        }, 5000);

        parser.once('data', (line) => {
            clearTimeout(timeout); // Cancela o timeout
            const fields = line.split(','); // Divide a sentença NMEA por vírgula

            // Verifica se a sentença é do tipo GNRMC
            if (fields[0] === '$GNRMC' && fields.length >= 7) {
                const latitude = fields[3]; // Latitude em formato NMEA
                const latitudeDirection = fields[4]; // N ou S
                const longitude = fields[5]; // Longitude em formato NMEA
                const longitudeDirection = fields[6]; // E ou W

                // Verifica se todos os dados estão presentes
                if (latitude && latitudeDirection && longitude && longitudeDirection) {
                    // Converte latitude NMEA para decimal
                    const latitudeDecimal = parseFloat(latitude.slice(0, 2)) + parseFloat(latitude.slice(2)) / 60;
                    // Converte longitude NMEA para decimal
                    const longitudeDecimal = parseFloat(longitude.slice(0, 3)) + parseFloat(longitude.slice(3)) / 60;

                    // Ajusta sinais conforme hemisférios
                    const locationData = {
                        latitude: latitudeDirection === 'N' ? latitudeDecimal : -latitudeDecimal,
                        longitude: longitudeDirection === 'E' ? longitudeDecimal : -longitudeDecimal
                    };

                    resolve(locationData); // Retorna os dados convertidos
                } else {
                    reject(new Error("Dados de GPS incompletos")); // Dados ausentes
                }
            } else {
                reject(new Error("Linha inválida do GPS")); // Sentença não reconhecida
            }
        });
    });
}

// A cada 20 segundos, lê GPS, envia via WebSocket e ThingSpeak
setInterval(async () => {
    try {
        const location = await readGPSData(); // Aguarda leitura

        console.log('📍 Localização obtida:', location); // Exibe no terminal

        // Envia a localização por WebSocket se o cliente estiver conectado
        if (currentWebSocket) {
            currentWebSocket.send(JSON.stringify(location)); // Envio JSON
        }

        // Envia a latitude ao canal do ThingSpeak
        axios.get('https://api.thingspeak.com/update', {
            params: {
                api_key: 'AR4Z865ODXLCZFDL', // Sua chave de API do ThingSpeak
                field1: location.latitude // Apenas latitude é enviada
            }
        }).then(response => {
            // Log de sucesso
            console.log(`✅ Dados enviados ao ThingSpeak: latitude=${location.latitude}, longitude=${location.longitude}`);
        }).catch(error => {
            // Log de erro ao enviar
            console.error('❌ Erro ao enviar para ThingSpeak:', error.message);
        });

    } catch (error) {
        // Log de erro na leitura GPS
        console.error('⚠️ Erro ao ler dados do GPS:', error.message);
    }
}, 20000); // Intervalo de 20 segundos

// Rota principal que serve o HTML da aplicação
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Envia index.html
});

// Servidor serve arquivos estáticos da pasta 'public'
app.use(express.static('public'));

// Inicia o servidor na porta 3001 em todas as interfaces (0.0.0.0)
const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTPS rodando na porta ${PORT}`); // Confirma início do servidor
});

// Função utilitária que executa comandos de terminal
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error); // Em caso de erro
            } else {
                resolve(stdout); // Retorna saída do comando
            }
        });
    });
}

// Executa a configuração dos pinos ao iniciar o sistema
configurePins();
