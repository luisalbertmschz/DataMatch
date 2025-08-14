'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { CodeEditor } from '@/components/ui/code-editor'
import { 
  Upload, 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Database,
  FileCode
} from 'lucide-react'

interface ProcessedFile {
  id: string
  name: string
  size: number
  content: string
  instalaciones: string[]
  circuito: string
}

interface ValidationResult {
  instalacao: string
  circuito: string
  estado: 'EXISTE' | 'NO_EXISTE'
  registros_encontrados: number
}

export default function FileCompress() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [files, setFiles] = useState<ProcessedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [compressedContent, setCompressedContent] = useState('')
  const [validationScript, setValidationScript] = useState('')
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
  const [activeTab, setActiveTab] = useState('upload')

  // Extraer circuito del nombre del archivo
  const extractCircuitFromFileName = (fileName: string): string => {
    // Buscar patrones comunes en nombres de archivos
    const patterns = [
      /(LPRA\d+)/i,      // LPRA110, LPRA103, etc.
      /(PALA\d+)/i,      // PALA103, PALA110, etc.
      /(CT\s*X\s*POLIGONOS\s+)([A-Z]+\d+)/i,  // CT X POLIGONOS LPRA110
      /([A-Z]{4}\d{3})/i,  // Patrón genérico: 4 letras + 3 números
    ]
    
    for (const pattern of patterns) {
      const match = fileName.match(pattern)
      if (match) {
        return match[1] || match[2] || 'CIRCUITO_DESCONOCIDO'
      }
    }
    
    // Si no hay patrón, usar el nombre del archivo sin extensión
    return fileName.replace(/\.sql$/i, '').substring(0, 15) || 'CIRCUITO_DESCONOCIDO'
  }

  // Extraer INSTALACAO de contenido SQL
  const extractInstalaciones = (content: string): string[] => {
    const instalacaoPattern = /WHERE\s+instalacao\s*=\s*['"`]?([^'"`;\s]+)['"`]?/gi
    const matches = [...content.matchAll(instalacaoPattern)]
    return matches.map(match => match[1]).filter(Boolean)
  }

  // Procesar archivos cargados
  const processFiles = async (fileList: FileList) => {
    setIsProcessing(true)
    const newFiles: ProcessedFile[] = []

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        if (!file.name.toLowerCase().endsWith('.sql')) {
          toast({
            title: "Archivo no válido",
            description: `${file.name} no es un archivo SQL válido.`,
            variant: "destructive"
          })
          continue
        }

        const content = await file.text()
        const circuito = extractCircuitFromFileName(file.name)
        const instalaciones = extractInstalaciones(content)

        newFiles.push({
          id: `${Date.now()}-${i}`,
          name: file.name,
          size: file.size,
          content,
          instalaciones,
          circuito
        })
      }

      setFiles(newFiles)
      toast({
        title: "Archivos procesados",
        description: `Se procesaron ${newFiles.length} archivos SQL exitosamente.`,
      })

      // Generar contenido comprimido automáticamente
      if (newFiles.length > 0) {
        generateCompressedFile(newFiles)
        generateValidationScript(newFiles)
      }

    } catch (error) {
      console.error('Error procesando archivos:', error)
      toast({
        title: "Error",
        description: "Ocurrió un error al procesar los archivos.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Generar archivo comprimido
  const generateCompressedFile = (fileList: ProcessedFile[]) => {
    let compressed = `-- ===========================================\n`
    compressed += `-- ARCHIVO COMPRIMIDO GENERADO POR FILECOMPRESS\n`
    compressed += `-- Fecha: ${new Date().toLocaleString()}\n`
    compressed += `-- Total archivos: ${fileList.length}\n`
    compressed += `-- ===========================================\n\n`

    fileList.forEach((file, index) => {
      compressed += `-- ARCHIVO ${index + 1}: ${file.name}\n`
      compressed += `-- CIRCUITO: ${file.circuito}\n`
      compressed += `-- INSTALACIONES: ${file.instalaciones.length}\n`
      compressed += `-- ===========================================\n`
      compressed += file.content
      compressed += `\n\n`
    })

    setCompressedContent(compressed)
  }

  // Generar script de validación
  const generateValidationScript = (fileList: ProcessedFile[]) => {
    const allInstalaciones = fileList.flatMap(file => 
      file.instalaciones.map(inst => ({ instalacao: inst, circuito: file.circuito }))
    )

    let script = `-- ===========================================\n`
    script += `-- SCRIPT DE VALIDACIÓN GENERADO POR FILECOMPRESS\n`
    script += `-- Fecha: ${new Date().toLocaleString()}\n`
    script += `-- Total archivos procesados: ${fileList.length}\n`
    script += `-- Total instalaciones a validar: ${allInstalaciones.length}\n`
    script += `-- ===========================================\n\n`

    // Verificar si superamos el límite de Oracle (1000 expresiones)
    if (allInstalaciones.length > 1000) {
      script += `-- ⚠️  ADVERTENCIA: Se supera el límite de 1000 expresiones en Oracle IN\n`
      script += `-- Se generará script con división automática en chunks\n\n`
      
      // Generar script con chunks
      script += generateChunkedValidationScript(allInstalaciones)
    } else {
      // Generar script normal (menos de 1000 instalaciones)
      script += generateNormalValidationScript(allInstalaciones)
    }

    setValidationScript(script)
  }

  // Generar script normal (menos de 1000 instalaciones)
  const generateNormalValidationScript = (allInstalaciones: Array<{instalacao: string, circuito: string}>) => {
    let script = `-- VALIDACIÓN DE EXISTENCIA EN UTRANSFORMADORA_LT\n`
    script += `SELECT \n`
    script += `    'VALIDACION' as tipo,\n`
    script += `    instalacao,\n`
    script += `    '${allInstalaciones[0]?.circuito || 'CIRCUITO'}' as circuito_origen,\n`
    script += `    CASE \n`
    script += `        WHEN COUNT(*) > 0 THEN 'EXISTE'\n`
    script += `        ELSE 'NO_EXISTE'\n`
    script += `    END as estado,\n`
    script += `    COUNT(*) as registros_encontrados\n`
    script += `FROM EDESURFLX_SGD.UTRANSFORMADORA_LT \n`
    script += `WHERE instalacao IN (\n`

    allInstalaciones.forEach((item, index) => {
      script += `    '${item.instalacao}'${index < allInstalaciones.length - 1 ? ',' : ''}  -- ${item.circuito}\n`
    })

    script += `)\n`
    script += `GROUP BY instalacao\n`
    script += `ORDER BY instalacao;\n\n`

    script += `-- RESUMEN POR CIRCUITO\n`
    script += `SELECT \n`
    script += `    circuito_origen,\n`
    script += `    COUNT(*) as total_instalaciones,\n`
    script += `    SUM(CASE WHEN estado = 'EXISTE' THEN 1 ELSE 0 END) as existentes,\n`
    script += `    SUM(CASE WHEN estado = 'NO_EXISTE' THEN 1 ELSE 0 END) as no_existentes\n`
    script += `FROM (\n`
    script += `    SELECT \n`
    script += `        '${allInstalaciones[0]?.circuito || 'CIRCUITO'}' as circuito_origen,\n`
    script += `        instalacao,\n`
    script += `        CASE \n`
    script += `            WHEN COUNT(*) > 0 THEN 'EXISTE'\n`
    script += `            ELSE 'NO_EXISTE'\n`
    script += `        END as estado\n`
    script += `    FROM EDESURFLX_SGD.UTRANSFORMADORA_LT \n`
    script += `    WHERE instalacao IN (\n`
    allInstalaciones.forEach((item, index) => {
      script += `        '${item.instalacao}'${index < allInstalaciones.length - 1 ? ',' : ''}\n`
    })
    script += `    )\n`
    script += `    GROUP BY instalacao\n`
    script += `) subquery\n`
    script += `GROUP BY circuito_origen;\n`

    return script
  }

  // Generar script con chunks (más de 1000 instalaciones)
  const generateChunkedValidationScript = (allInstalaciones: Array<{instalacao: string, circuito: string}>) => {
    const CHUNK_SIZE = 1000
    const chunks = []
    
    // Dividir en chunks de 1000
    for (let i = 0; i < allInstalaciones.length; i += CHUNK_SIZE) {
      chunks.push(allInstalaciones.slice(i, i + CHUNK_SIZE))
    }

    let script = `-- SOLUCIÓN 1: DIVISIÓN EN CHUNKS (Recomendado para Oracle)\n`
    script += `-- Se dividieron ${allInstalaciones.length} instalaciones en ${chunks.length} chunks de máximo ${CHUNK_SIZE}\n\n`

    // Generar cada chunk
    chunks.forEach((chunk, chunkIndex) => {
      script += `-- CHUNK ${chunkIndex + 1} (${chunkIndex * CHUNK_SIZE + 1}-${Math.min((chunkIndex + 1) * CHUNK_SIZE, allInstalaciones.length)})\n`
      script += `SELECT \n`
      script += `    'VALIDACION' as tipo,\n`
      script += `    instalacao,\n`
      script += `    '${chunk[0]?.circuito || 'CIRCUITO'}' as circuito_origen,\n`
      script += `    CASE \n`
      script += `        WHEN COUNT(*) > 0 THEN 'EXISTE'\n`
      script += `        ELSE 'NO_EXISTE'\n`
      script += `    END as estado,\n`
      script += `    COUNT(*) as registros_encontrados\n`
      script += `FROM EDESURFLX_SGD.UTRANSFORMADORA_LT \n`
      script += `WHERE instalacao IN (\n`

      chunk.forEach((item, index) => {
        script += `    '${item.instalacao}'${index < chunk.length - 1 ? ',' : ''}  -- ${item.circuito}\n`
      })

      script += `)\n`
      script += `GROUP BY instalacao\n`
      script += `ORDER BY instalacao\n`
      
      if (chunkIndex < chunks.length - 1) {
        script += `UNION ALL\n\n`
      } else {
        script += `;\n\n`
      }
    })

    // Agregar resumen por circuito
    script += `-- RESUMEN POR CIRCUITO (Combinando todos los chunks)\n`
    script += `SELECT \n`
    script += `    circuito_origen,\n`
    script += `    COUNT(*) as total_instalaciones,\n`
    script += `    SUM(CASE WHEN estado = 'EXISTE' THEN 1 ELSE 0 END) as existentes,\n`
    script += `    SUM(CASE WHEN estado = 'NO_EXISTE' THEN 1 ELSE 0 END) as no_existentes\n`
    script += `FROM (\n`
    script += `    -- Aquí debes ejecutar todos los chunks anteriores y combinar resultados\n`
    script += `    -- O usar la siguiente alternativa con tabla temporal\n`
    script += `) subquery\n`
    script += `GROUP BY circuito_origen;\n\n`

    // Agregar alternativa con tabla temporal
    script += `-- SOLUCIÓN 2: TABLA TEMPORAL (Alternativa más eficiente)\n`
    script += `-- Crear tabla temporal\n`
    script += `CREATE GLOBAL TEMPORARY TABLE TEMP_INSTALACIONES (\n`
    script += `    instalacao VARCHAR2(20),\n`
    script += `    circuito VARCHAR2(50)\n`
    script += `) ON COMMIT PRESERVE ROWS;\n\n`

    script += `-- Insertar todas las instalaciones\n`
    allInstalaciones.forEach((item, index) => {
      script += `INSERT INTO TEMP_INSTALACIONES VALUES ('${item.instalacao}', '${item.circuito}');\n`
    })

    script += `\n-- Consulta usando JOIN (sin límite de 1000)\n`
    script += `SELECT \n`
    script += `    t.instalacao,\n`
    script += `    t.circuito as circuito_origen,\n`
    script += `    CASE \n`
    script += `        WHEN COUNT(u.instalacao) > 0 THEN 'EXISTE'\n`
    script += `        ELSE 'NO_EXISTE'\n`
    script += `    END as estado,\n`
    script += `    COUNT(u.instalacao) as registros_encontrados\n`
    script += `FROM TEMP_INSTALACIONES t\n`
    script += `LEFT JOIN EDESURFLX_SGD.UTRANSFORMADORA_LT u ON t.instalacao = u.instalacao\n`
    script += `GROUP BY t.instalacao, t.circuito\n`
    script += `ORDER BY t.circuito, t.instalacao;\n\n`

    script += `-- Limpiar tabla temporal\n`
    script += `DROP TABLE TEMP_INSTALACIONES;\n`

    return script
  }

  // Descargar archivo comprimido
  const downloadCompressedFile = () => {
    const blob = new Blob([compressedContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `archivos_comprimidos_${new Date().toISOString().split('T')[0]}.sql`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: "Descarga completada",
      description: "Archivo comprimido descargado exitosamente.",
    })
  }

  // Descargar script de validación
  const downloadValidationScript = () => {
    const blob = new Blob([validationScript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `script_validacion_${new Date().toISOString().split('T')[0]}.sql`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: "Descarga completada",
      description: "Script de validación descargado exitosamente.",
    })
  }

  // Limpiar archivos
  const clearFiles = () => {
    setFiles([])
    setCompressedContent('')
    setValidationScript('')
    setValidationResults([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    toast({
      title: "Archivos limpiados",
      description: "Todos los archivos han sido eliminados.",
    })
  }

  // Eliminar archivo específico
  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId)
    setFiles(updatedFiles)
    
    if (updatedFiles.length > 0) {
      generateCompressedFile(updatedFiles)
      generateValidationScript(updatedFiles)
    } else {
      setCompressedContent('')
      setValidationScript('')
    }
    
    toast({
      title: "Archivo eliminado",
      description: "El archivo ha sido eliminado exitosamente.",
    })
  }

  // Manejar drop de archivos
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">FileCompress</h1>
        <p className="text-xl text-gray-600">
          Comprime archivos SQL y genera scripts de validación
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Upload className="w-4 h-4 mr-2" />
            Cargar Archivos
          </TabsTrigger>
          <TabsTrigger value="compressed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Archivo Comprimido
          </TabsTrigger>
          <TabsTrigger value="validation" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Database className="w-4 h-4 mr-2" />
            Script Validación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Cargar Archivos SQL</span>
              </CardTitle>
              <CardDescription>
                Arrastra y suelta archivos .sql o haz clic para seleccionarlos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".sql"
                  onChange={(e) => e.target.files && processFiles(e.target.files)}
                  className="hidden"
                />
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Arrastra archivos SQL aquí o
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Seleccionar Archivos
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  Solo archivos .sql son aceptados
                </p>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Procesando archivos...</span>
                    <span>{files.length} archivos</span>
                  </div>
                  <Progress value={files.length > 0 ? 100 : 0} className="w-full" />
                </div>
              )}

              {files.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Archivos Cargados ({files.length})</h3>
                    <Button onClick={clearFiles} variant="outline" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpiar Todo
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {files.map((file) => (
                      <Card key={file.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <FileCode className="w-5 h-5 text-blue-600" />
                              <div>
                                <p className="font-medium">{file.name}</p>
                                <div className="flex items-center space-x-4 text-sm text-gray-500">
                                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                                  <span>•</span>
                                  <span className="flex items-center">
                                    <Database className="w-3 h-3 mr-1" />
                                    {file.circuito}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {file.instalaciones.length} instalaciones
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => removeFile(file.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{files.length}</div>
                      <div className="text-sm text-gray-600">Archivos Cargados</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {files.reduce((total, file) => total + file.instalaciones.length, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Instalaciones</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {new Set(files.map(f => f.circuito)).size}
                      </div>
                      <div className="text-sm text-gray-600">Circuitos Únicos</div>
                    </div>
                  </div>

                  {/* Advertencia de límite Oracle */}
                  {files.reduce((total, file) => total + file.instalaciones.length, 0) > 1000 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        <div>
                          <h4 className="font-medium text-yellow-800">
                            ⚠️ Advertencia: Límite de Oracle Detectado
                          </h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Se detectaron más de 1000 instalaciones. Oracle tiene un límite de 1000 expresiones en la cláusula IN. 
                            El script de validación se generará automáticamente con división en chunks o usando tabla temporal.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compressed" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Archivo Comprimido</span>
              </CardTitle>
              <CardDescription>
                Contenido combinado de todos los archivos SQL cargados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {compressedContent ? (
                <>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Archivo comprimido generado
                    </Badge>
                    <Button onClick={downloadCompressedFile} className="bg-green-600 hover:bg-green-700">
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Archivo
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg">
                    <CodeEditor
                      code={compressedContent}
                      language="sql"
                      showLineNumbers={true}
                      showThemeToggle={true}
                      showCopyButton={true}
                      showDownloadButton={false}
                      height="600px"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No hay archivos comprimidos</p>
                  <p className="text-sm">Carga archivos SQL en la pestaña "Cargar Archivos" para generar el contenido comprimido</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="w-5 h-5" />
                <span>Script de Validación</span>
              </CardTitle>
              <CardDescription>
                Script SQL para validar la existencia de instalaciones en UTRANSFORMADORA_LT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationScript ? (
                <>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700">
                      Script de validación generado
                    </Badge>
                    <Button onClick={downloadValidationScript} className="bg-purple-600 hover:bg-purple-700">
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Script
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg">
                    <CodeEditor
                      code={validationScript}
                      language="sql"
                      showLineNumbers={true}
                      showThemeToggle={true}
                      showCopyButton={true}
                      showDownloadButton={false}
                      height="600px"
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No hay script de validación</p>
                  <p className="text-sm">Carga archivos SQL en la pestaña "Cargar Archivos" para generar el script de validación</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
