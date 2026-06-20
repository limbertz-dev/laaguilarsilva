import { HashRouter } from 'react-router-dom'
import { AppRoutes } from './routes/AppRoutes'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}

export default App