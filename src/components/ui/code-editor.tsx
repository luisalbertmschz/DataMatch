"use client"

import { useState } from "react"
import { Copy, Download, Sun, Moon, Code, FileText } from "lucide-react"
import { Button } from "./button"
import { useToast } from "@/hooks/use-toast"

interface CodeEditorProps {
  code: string
  language?: string
  title?: string
  onCopy?: () => void
  onDownload?: () => void
  showLineNumbers?: boolean
  className?: string
}

export function CodeEditor({
  code,
  language = "sql",
  title = "Código SQL",
  onCopy,
  onDownload,
  showLineNumbers = true,
  className = ""
}: CodeEditorProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const { toast } = useToast()

  const handleCopy = () => {
    if (onCopy) {
      onCopy()
    } else {
      navigator.clipboard.writeText(code)
      toast({
        title: "Código copiado",
        description: "El código ha sido copiado al portapapeles",
      })
    }
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else {
      const blob = new Blob([code], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.sql`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast({
        title: "Archivo descargado",
        description: "El código ha sido descargado exitosamente",
      })
    }
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  // Resaltado básico de sintaxis SQL
  const highlightSQL = (code: string) => {
    const keywords = [
      "SELECT", "FROM", "WHERE", "IN", "ORDER BY", "UPDATE", "SET", "INSERT", "INTO", "VALUES",
      "DELETE", "CREATE", "DROP", "TABLE", "INDEX", "VIEW", "PROCEDURE", "FUNCTION", "TRIGGER",
      "ALTER", "ADD", "MODIFY", "RENAME", "GRANT", "REVOKE", "COMMIT", "ROLLBACK", "SAVEPOINT",
      "UNION", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "GROUP BY", "HAVING", "DISTINCT",
      "COUNT", "SUM", "AVG", "MAX", "MIN", "CASE", "WHEN", "THEN", "ELSE", "END", "AS"
    ]
    
    const operators = ["=", "<>", ">", "<", ">=", "<=", "AND", "OR", "NOT", "LIKE", "IS", "NULL"]
    
    let highlightedCode = code
    
    // Resaltar palabras clave
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, "gi")
      highlightedCode = highlightedCode.replace(regex, `<span class="keyword">${keyword}</span>`)
    })
    
    // Resaltar operadores
    operators.forEach(operator => {
      const regex = new RegExp(`\\b${operator}\\b`, "gi")
      highlightedCode = highlightedCode.replace(regex, `<span class="operator">${operator}</span>`)
    })
    
    // Resaltar strings (comillas simples)
    highlightedCode = highlightedCode.replace(/'([^']*)'/g, `<span class="string">'$1'</span>`)
    
    // Resaltar comentarios
    highlightedCode = highlightedCode.replace(/--(.+)$/gm, `<span class="comment">--$1</span>`)
    
    // Resaltar números
    highlightedCode = highlightedCode.replace(/\b(\d+)\b/g, `<span class="number">$1</span>`)
    
    return highlightedCode
  }

  const lines = code.split("\n")
  const highlightedCode = highlightSQL(code)

  return (
    <div className={`rounded-xl overflow-hidden border ${className}`}>
      {/* Header del editor */}
      <div className={`
        flex items-center justify-between px-4 py-3 border-b
        ${theme === "dark" 
          ? "bg-gray-900 border-gray-700 text-gray-200" 
          : "bg-gray-50 border-gray-200 text-gray-700"
        }
      `}>
        <div className="flex items-center space-x-3">
          <Code className="w-5 h-5" />
          <span className="font-medium">{title}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
            {language.toUpperCase()}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className={`
              ${theme === "dark" 
                ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800" 
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }
            `}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className={`
              ${theme === "dark" 
                ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800" 
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }
            `}
          >
            <Copy className="w-4 h-4 mr-2" />
            Copiar
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className={`
              ${theme === "dark" 
                ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800" 
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              }
            `}
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar
          </Button>
        </div>
      </div>

      {/* Contenido del editor */}
      <div className={`
        relative overflow-auto max-h-96
        ${theme === "dark" ? "bg-gray-900" : "bg-white"}
      `}>
        {showLineNumbers && (
          <div className={`
            absolute left-0 top-0 w-16 text-right pr-4 pt-4 pb-4 select-none
            ${theme === "dark" ? "text-gray-500 bg-gray-900" : "text-gray-400 bg-white"}
            border-r ${theme === "dark" ? "border-gray-700" : "border-gray-200"}
          `}>
            {lines.map((_, index) => (
              <div key={index} className="text-xs leading-6">
                {index + 1}
              </div>
            ))}
          </div>
        )}
        
        <div className={`
          pl-${showLineNumbers ? "20" : "4"} pr-4 py-4
          ${theme === "dark" ? "text-gray-200" : "text-gray-800"}
        `}>
          <pre className="text-sm leading-6 font-mono">
            <code 
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
              className="block"
            />
          </pre>
        </div>
      </div>

      {/* Footer del editor */}
      <div className={`
        px-4 py-2 text-xs border-t
        ${theme === "dark" 
          ? "bg-gray-800 border-gray-700 text-gray-400" 
          : "bg-gray-50 border-gray-200 text-gray-500"
        }
      `}>
        <div className="flex items-center justify-between">
          <span>{lines.length} líneas</span>
          <span>{code.length} caracteres</span>
        </div>
      </div>
    </div>
  )
}
