import React, { createContext, useContext, useState } from 'react';
import CustomAlert from '../components/CustomAlert';

const CustomAlertContext = createContext({
    showAlert: () => { },
    hideAlert: () => { },
});

export const CustomAlertProvider = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState({
        title: '',
        message: '',
        type: 'success',
        confirmText: 'Entendido',
        cancelText: null,       // null = no mostrar botón cancelar
        dismissText: null,      // null = no mostrar tercer botón rojo
        onConfirm: null,
        onClose: null,
        onDismiss: null,
    });

    /**
     * showAlert(title, message, type, confirmText, onClose)
     *   — Alerta simple de 1 botón (retrocompatible)
     *
     * showAlert(title, message, type, confirmText, onClose, cancelText, onConfirm)
     *   — Alerta de 2 botones (confirmar / cancelar)
     */
    const showAlert = (
        title,
        message,
        type = 'success',
        confirmText = 'Entendido',
        onClose = null,
        cancelText = null,
        onConfirm = null,
        dismissText = null,
        onDismiss = null
    ) => {
        setConfig({ title, message, type, confirmText, cancelText, dismissText, onConfirm, onClose, onDismiss });
        setVisible(true);
    };

    const hideAlert = () => {
        setVisible(false);
        if (config.onClose) config.onClose();
    };

    const handleConfirm = () => {
        setVisible(false);
        if (config.onConfirm) config.onConfirm();
    };

    const handleDismiss = () => {
        setVisible(false);
        if (config.onDismiss) config.onDismiss();
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
                dismissText={config.dismissText}
                onClose={hideAlert}
                onConfirm={config.onConfirm ? handleConfirm : null}
                onDismiss={config.onDismiss ? handleDismiss : null}
            />
        </CustomAlertContext.Provider>
    );
};

export const useCustomAlert = () => useContext(CustomAlertContext);
