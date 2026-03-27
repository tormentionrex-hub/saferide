import React, { createContext, useContext, useState } from 'react';
import CustomAlert from '../components/CustomAlert';

const CustomAlertContext = createContext({
    showAlert: () => {},
    hideAlert: () => {},
});

export const CustomAlertProvider = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState({
        title: '',
        message: '',
        type: 'success',
        confirmText: 'Entendido',
        onClose: null
    });

    const showAlert = (title, message, type = 'success', confirmText = 'Entendido', onClose = null) => {
        setConfig({ title, message, type, confirmText, onClose });
        setVisible(true);
    };

    const hideAlert = () => {
        setVisible(false);
        if (config.onClose) config.onClose();
    };

    return (
        <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <CustomAlert
                visible={visible}
                title={config.title}
                message={config.message}
                type={config.type}
                confirmText={config.confirmText}
                onClose={hideAlert}
            />
        </CustomAlertContext.Provider>
    );
};

export const useCustomAlert = () => useContext(CustomAlertContext);
