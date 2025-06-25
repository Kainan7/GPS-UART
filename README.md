# 📡 Rastreador GPS com Node.js e Integração Web

Projeto desenvolvido na disciplina de Computação Embarcada, com o objetivo de criar um sistema de rastreamento GPS em tempo real utilizando **BeagleBone Black**, **Node.js**, e visualização via **API do Bing Maps** e integração com a nuvem via **ThingSpeak**.

## 🔍 Visão Geral

Este projeto embarcado implementa um sistema de rastreamento geográfico com as seguintes funcionalidades:

- Captura de coordenadas via UART (GPS GY-GPS6MV2)
- Backend com Node.js para leitura e envio dos dados
- Servidor HTTPS com canal WebSocket (WSS) para atualização em tempo real
- Interface web com mapa interativo usando a API do Bing Maps
- Envio das coordenadas para a nuvem com ThingSpeak

---

## 🛠️ Tecnologias Utilizadas

- **BeagleBone Black**
- **Node.js**
- **Express**
- **Serialport**
- **WebSocket (ws)**
- **Axios**
- **ThingSpeak**
- **Bing Maps API**
- **HTML / CSS / JavaScript**

---

## 🧩 Estrutura do Projeto

```bash
.
├── track.js               # Script principal do backend
├── index.html             # Interface web com mapa
├── cert/                  # Certificados SSL para HTTPS
├── public/                # Recursos estáticos da interface (JS, CSS)
├── config-pin.sh          # Script para configuração dos pinos UART
└── README.md              # Este arquivo
