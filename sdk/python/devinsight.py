"""
DevInsight Python SDK

Captura automaticamente exceções não tratadas e envia para a API DevInsight.

Uso rápido:
    from devinsight import DevInsight
    DevInsight.init(api_key='SUA_API_KEY', project_name='meu-projeto')

Ou manualmente:
    client = DevInsight(api_key='SUA_API_KEY')
    client.report(tipo='silent_backend_error', mensagem=str(e))
"""

import json
import sys
import traceback
import urllib.request
import urllib.error

DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com'


class DevInsight:
    _initialized = False

    def __init__(self, api_key, base_url=None):
        if not api_key:
            raise ValueError('DevInsight: api_key é obrigatória')
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip('/')

    def report(self, tipo, mensagem='', contexto=None, dados=None):
        """Envia um diagnóstico para a API DevInsight.

        Args:
            tipo: Categoria do erro (ex: 'silent_backend_error', 'sql_analysis').
            mensagem: Mensagem de erro (ex: str(e)).
            contexto: Dict com dados adicionais (rota, método, etc.).
            dados: Dict para sql_analysis (query, tempo_execucao).

        Returns:
            Dict com o diagnóstico retornado pela API.
        """
        if not tipo:
            raise ValueError("DevInsight: campo 'tipo' é obrigatório")

        body = {'tipo': tipo, 'mensagem': mensagem}
        if contexto:
            body['contexto'] = contexto
        if dados:
            body['dados'] = dados

        encoded = json.dumps(body).encode('utf-8')
        req = urllib.request.Request(
            f'{self.base_url}/v1/diagnosticos',
            data=encoded,
            method='POST',
        )
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', f'Bearer {self.api_key}')

        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))

    @classmethod
    def init(cls, api_key, project_name='unknown', base_url=None):
        """Registra o hook de exceções não tratadas.

        Após chamar init(), qualquer exceção que derrube o processo é
        automaticamente enviada para a API antes de encerrar.

        Args:
            api_key: Sua API Key (obtida em /v1/auth/me).
            project_name: Nome do projeto (aparece no contexto do diagnóstico).
            base_url: URL base da API (padrão: https://devinsight-api.onrender.com).
        """
        if cls._initialized:
            return

        client = cls(api_key=api_key, base_url=base_url)
        cls._initialized = True

        original_excepthook = sys.excepthook

        def _excepthook(exc_type, exc_value, exc_traceback):
            stack = ''.join(traceback.format_tb(exc_traceback))
            try:
                client.report(
                    tipo='silent_backend_error',
                    mensagem=str(exc_value),
                    contexto={
                        'project_name': project_name,
                        'exception_type': exc_type.__name__,
                        'stack': stack,
                    },
                )
            except Exception:
                # Nunca suprimir o erro original
                pass
            original_excepthook(exc_type, exc_value, exc_traceback)

        sys.excepthook = _excepthook
