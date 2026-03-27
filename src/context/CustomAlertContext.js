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
        cancelText: 'Cancelar',
        onConfirm: null,
        onClose: null
    });

    const showAlert = (title, message, type = 'success', confirmText = 'Entendido', cancelText = 'Cancelar', onConfirm = null, onClose = null) => {
        setConfig({ title, message, type, confirmText, cancelText, onConfirm, onClose });
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
                cancelText={config.cancelText}
                onConfirm={config.onConfirm}
                onClose={hideAlert}
            />
        </CustomAlertContext.Provider>
    );
};

export const useCustomAlert = () => useContext(CustomAlertContext);
