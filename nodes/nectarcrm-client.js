module.exports = function(RED) {
    function NectarCRMClientNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        const axios = require('axios');
        const nectaCRMApiUrl = 'https://app.nectarcrm.com.br';

        node.on('input', async function(msg) {
            try {
                
                const clientSecret = msg.credentials.clientSecret;

                const method = config.method;
                
                let response;
                let hasMore = true;
                let page = 1;

                switch (method) {
                    case 'getDeals':
                        let allDeals = [];
                        while (hasMore) {
                            response = await axios.get(`${nectaCRMApiUrl}/crm/api/1/oportunidades`, {
                                params: {
                                    api_token: clientSecret,
                                    page: page
                                }
                            });

                            allDeals = allDeals.concat(response.data);

                            hasMore = response.data.length > 0;
                            page++;
                        }

                        msg.payload = allDeals.map(deal => {
                            return {
                                name: deal.nome,
                                id: deal.id,
                                created_at: deal.dataCriacao,
                                updated_at: deal.dataAtualizacao,
                                estimated_amount: deal.valorTotal,
                                customer: deal.cliente,
                                funnel_stage: deal.funilVenda.nome,
                                user: {
                                    id: deal.responsavel?.id
                                },
                                hold: false,
                                win: deal.status === 2 ? true : false,
                                prediction_date: deal.dataLimite,
                            };
                        });

                        break;
                    case 'getTasks':
                        let allTasks = [];

                        while (hasMore) {
                            response = await axios.get(`${nectaCRMApiUrl}/crm/api/1/tarefas`, {
                                params: {
                                    api_token: clientSecret,
                                    page: page,
                                }
                            });

                            allTasks = allTasks.concat(response.data);

                            hasMore = response.data.length > 0;
                            page++;
                        }

                        const types = {
                            0: 'task',
                            1: 'call',
                            2: 'task',
                            3: 'email',
                            4: 'task'
                        };

                        msg.payload = allTasks.map(task => {
                            return {
                                subject: task.titulo,
                                id: task.id,
                                created_at: task.dataCriacao,
                                updated_at: task.dataAtualizacao,
                                done: task.status === 1 ? true : false,
                                deal: {
                                    id: task.oportunidade?.id
                                },
                                date: task.dataLimite,
                                type: types[task.tipo],
                                user_ids: [task.responsavel?.id],
                            }
                        });
                        
                        break;
                    case 'addNotes':
                        response = await axios.post(
                            `${nectaCRMApiUrl}/crm/api/1/publicacao`,
                            {
                                assunto: "Anotação (Collabee AI)",
                                descricao: msg.payload.note,
                                automatica: false,
                                oportunidade: {
                                    id: msg.payload.deal_id
                                }
                            },
                            {
                                params: {
                                    api_token: clientSecret,
                                }
                            }
                        );

                        msg.payload = response.data;
                        break;
                    case 'getUsers':

                        response = await axios.get(`${nectaCRMApiUrl}/crm/api/1/usuarios`, {
                            params: {
                                api_token: clientSecret,
                                page: -1,
                            }
                        });

                        const data = response.data;
                        msg.payload = {
                            users: data.map(user => {
                                return {
                                    name: user.nome,
                                    id: user.id,
                                    email: user.email,
                                };
                            })
                        };
                        break;
                    default:
                        node.error("Método não suportado", msg);
                        return;
                }

                node.send(msg);

            } catch (error) {
                node.error("Erro ao conectar à API do Necta CRM: " + error.message, msg);
            }
        });
    }
    RED.nodes.registerType("nectarcrm-client", NectarCRMClientNode);
}
