"use client";

import { useEffect, useState } from "react";

export default function Diagnostico() {
  const [info, setInfo]   = useState<string[]>([]);
  const [log,  setLog]    = useState<string[]>([]);

  useEffect(function() {
    var logs: string[] = [];

    var checks = [
      "SunmiPrinter", "printer", "sunmiPrinter",
      "InnerPrinter", "Android", "SunmiDevice",
      "JSBridge", "sunmi", "SUNMI",
    ];

    checks.forEach(function(name) {
      var existe = !!(window as any)[name];
      logs.push(name + ": " + (existe ? "✅ ENCONTRADO" : "❌ não existe"));
    });

    logs.push("---");
    logs.push("UA: " + navigator.userAgent);
    logs.push("Platform: " + navigator.platform);

    var isSunmi = navigator.userAgent.toLowerCase().includes("sunmi");
    logs.push("É SUNMI: " + (isSunmi ? "✅ SIM" : "❌ NÃO"));

    // Verificar window.print
    logs.push("window.print: " + (typeof window.print === "function" ? "✅ disponível" : "❌ ausente"));

    setInfo(logs);
  }, []);

  function testarImpressora() {
    var resultados: string[] = [];
    try {
      var p = (window as any).SunmiPrinter || (window as any).printer;
      if (!p) {
        resultados.push("❌ Impressora SUNMI não encontrada no window");
      } else {
        resultados.push("✅ Objeto impressora encontrado: " + JSON.stringify(Object.keys(p)));
        p.printText?.("TESTE COFFEE & BEATS\n");
        p.lineWrap?.(3);
        resultados.push("✅ Comando printText enviado");
      }
    } catch(e) {
      resultados.push("❌ Erro: " + String(e));
    }
    setLog(resultados);
  }

  function testarWindowPrint() {
    var resultados: string[] = [];
    try {
      window.print();
      resultados.push("✅ window.print() chamado");
    } catch(e) {
      resultados.push("❌ Erro: " + String(e));
    }
    setLog(resultados);
  }

  return (
    <div style={{
      background: "#1a0a00",
      color: "#f5edd6",
      padding: "20px",
      minHeight: "100vh",
      fontFamily: "monospace",
      fontSize: "14px",
    }}>
      <h1 style={{ color: "#C8853A", marginBottom: "20px", fontSize: "20px" }}>
        🔍 Diagnóstico SUNMI
      </h1>

      {/* Resultado dos checks */}
      <div style={{ marginBottom: "24px" }}>
        {info.map(function(linha, i) {
          return (
            <div key={i} style={{ marginBottom: "6px", opacity: linha === "---" ? 0.3 : 1 }}>
              {linha === "---" ? "──────────────────────" : linha}
            </div>
          );
        })}
      </div>

      {/* Log de testes */}
      {log.length > 0 && (
        <div style={{
          background: "rgba(200,133,58,0.1)",
          border: "1px solid rgba(200,133,58,0.4)",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "20px",
        }}>
          {log.map(function(l, i) { return <div key={i}>{l}</div>; })}
        </div>
      )}

      {/* Botões de teste */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "360px" }}>
        <button
          onClick={testarImpressora}
          style={{
            background: "#C8853A",
            color: "#1a0a00",
            padding: "14px 24px",
            borderRadius: "10px",
            border: "none",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          🖨️ Testar Impressora SUNMI
        </button>

        <button
          onClick={testarWindowPrint}
          style={{
            background: "rgba(246,240,229,0.1)",
            color: "#f5edd6",
            padding: "14px 24px",
            borderRadius: "10px",
            border: "1px solid rgba(246,240,229,0.3)",
            fontWeight: "bold",
            fontSize: "16px",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          🖨️ Testar window.print()
        </button>

        <button
          onClick={function() { window.location.reload(); }}
          style={{
            background: "transparent",
            color: "rgba(246,240,229,0.4)",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid rgba(246,240,229,0.15)",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          🔄 Retestar
        </button>
      </div>

      <div style={{ marginTop: "32px", opacity: 0.4, fontSize: "12px" }}>
        <div>Coffee &amp; Beats — Diagnóstico v1</div>
        <div>Acesse este endereço no dispositivo SUNMI D2 Mini</div>
      </div>
    </div>
  );
}
