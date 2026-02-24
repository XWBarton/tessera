import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import App from './App'
import './index.css'
import 'antd/dist/reset.css'
import 'leaflet/dist/leaflet.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#2e7d32',
            colorBgLayout: '#f4f7f4',
            fontFamily: "'Lora', Georgia, 'Times New Roman', serif",
            borderRadius: 6,
            colorBorder: '#d9e8d9',
          },
          components: {
            Layout: {
              siderBg: '#ffffff',
              headerBg: '#ffffff',
              bodyBg: '#f4f7f4',
            },
            Menu: {
              itemSelectedBg: '#e8f5e9',
              itemSelectedColor: '#2e7d32',
              itemHoverBg: '#f1f8f1',
            },
            Button: {
              primaryColor: '#ffffff',
            },
          },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
