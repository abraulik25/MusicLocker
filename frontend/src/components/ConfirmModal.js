import React from 'react';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Bestätigen",
    message = "Bist du sicher?",
    confirmText = "Löschen",
    cancelText = "Abbrechen",
    isDanger = true
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <h3>{title}</h3>
                <p className="text-md text-lo" style={{ marginBottom: 24 }}>{message}</p>
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onClose}>{cancelText}</button>
                    <button
                        className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => { onConfirm(); onClose(); }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
