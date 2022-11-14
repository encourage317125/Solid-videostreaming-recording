/* @refresh reload */
import { render } from 'solid-js/web';
import { Router } from "@solidjs/router";
import { HopeProvider, HopeThemeConfig, NotificationsProvider } from '@hope-ui/solid'
import './index.css';
import App from './App';

const config: HopeThemeConfig = {
    lightTheme: {
        colors: {
            primary9: "salmon"
        }
    }
}

render(
    () => (
        <HopeProvider config={config}>
            <NotificationsProvider placement="top-end">
                <Router>
                    <App />
                </Router>
            </NotificationsProvider>
        </HopeProvider>
    ),
    document.getElementById('root') as HTMLElement
);
