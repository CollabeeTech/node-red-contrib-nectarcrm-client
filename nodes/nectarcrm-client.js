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
                let requestCount = 0;

                async function delay(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }

                async function fetchData(url, params) {
                    await delay(1000);
                    
                    const response = await axios.get(url, { params });

                    requestCount++;

                    if (requestCount === 5) {
                        await delay(5000);
                        requestCount = 0;
                    }

                    return response;
                }


                const types = {
                    0: 'task',
                    1: 'call',
                    2: 'task',
                    3: 'email',
                    4: 'task'
                };

                switch (method) {
                    case 'getDeals':
                        let allDeals = [];
                        while (hasMore) {
                            response = await fetchData(`${nectaCRMApiUrl}/crm/api/1/oportunidades`, {
                                api_token: clientSecret,
                                page: page,
                                displayLength: 100
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
                            response = await fetchData(`${nectaCRMApiUrl}/crm/api/1/tarefas`, {
                                api_token: clientSecret,
                                page: page,
                                displayLength: 100
                            });

                            allTasks = allTasks.concat(response.data);

                            hasMore = response.data.length > 0;
                            page++;
                        }

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

                        response = await fetchData(`${nectaCRMApiUrl}/crm/api/1/usuarios`, {
                            api_token: clientSecret,
                            page: -1,
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
                    case 'markTaskDone':
                        response = await axios.put(
                            `${nectaCRMApiUrl}/crm/api/1/tarefas/${msg.payload.task_id}`,
                            {
                                status: 1
                            },
                            {
                                params: {
                                    api_token: clientSecret,
                                },
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        msg.payload = response.data;
                        break;
                    case 'getTask':
                        response = await fetchData(`${nectaCRMApiUrl}/crm/api/1/tarefas/${msg.payload.task_id}`, {
                            api_token: clientSecret
                        });


                        msg.payload = {
                            subject: response.titulo,
                            id: response.id,
                            created_at: response.dataCriacao,
                            updated_at: response.dataAtualizacao,
                            done: response.status === 1 ? true : false,
                            deal: {
                                id: response.oportunidade?.id
                            },
                            date: response.dataLimite,
                            type: types[response.tipo],
                            user_ids: [response.responsavel?.id],
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
