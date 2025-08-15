'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { CodeEditor } from '@/components/ui/code-editor'
import { 
  Upload, 
  FileText, 
  Download, 
  Copy, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Database,
  FileCode,
  Mail
} from 'lucide-react'

interface ProcessedFile {
  id: string
  name: string
  size: number
  content: string
  instalaciones: string[]
  circuito: string
}

export default function FileCompress() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [files, setFiles] = useState<ProcessedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [compressedContent, setCompressedContent] = useState('')
  const [validationScript, setValidationScript] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [activeTab, setActiveTab] = useState('upload')

  // Extraer circuito del nombre del archivo
  const extractCircuitFromFileName = (fileName: string): string => {
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
          content: content,
          instalaciones: instalaciones,
          circuito: circuito
        })
      }

      setFiles(newFiles)
      
      if (newFiles.length > 0) {
        generateCompressedFile(newFiles)
        generateValidationScript(newFiles)
        generateEmailMessage(newFiles)
      }

      toast({
        title: "Archivos procesados",
        description: `${newFiles.length} archivos SQL procesados exitosamente.`,
      })
    } catch (error) {
      toast({
        title: "Error al procesar archivos",
        description: "Ocurrió un error al procesar los archivos.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Generar archivo comprimido
  const generateCompressedFile = (fileList: ProcessedFile[]) => {
    let content = `-- ===========================================\n`
    content += `-- ARCHIVO COMPRIMIDO GENERADO POR FILECOMPRESS\n`
    content += `-- Fecha: ${new Date().toLocaleString()}\n`
    content += `-- Total archivos: ${fileList.length}\n`
    content += `-- ===========================================\n\n`

    fileList.forEach((file, index) => {
      content += `-- ARCHIVO ${index + 1}: ${file.name}\n`
      content += `-- Circuito: ${file.circuito}\n`
      content += `-- Instalaciones: ${file.instalaciones.length}\n`
      content += `-- ===========================================\n\n`
      content += file.content
      content += `\n\n`
    })

    setCompressedContent(content)
  }

  // Generar script de validación simple
  const generateValidationScript = (fileList: ProcessedFile[]) => {
    const allInstalaciones = fileList.flatMap(file => 
      file.instalaciones.map(inst => ({ instalacao: inst, circuito: file.circuito }))
    )

    let script = `-- ===========================================\n`
    script += `-- SCRIPT DE VALIDACIÓN SIMPLE\n`
    script += `-- Fecha: ${new Date().toLocaleString()}\n`
    script += `-- Total instalaciones: ${allInstalaciones.length}\n`
    script += `-- ===========================================\n\n`

    script += `-- VALIDAR EXISTENCIA EN UTRANSFORMADORA_LT\n`
    script += `SELECT \n`
    script += `    instalacao,\n`
    script += `    CASE \n`
    script += `        WHEN COUNT(*) > 0 THEN 'EXISTE'\n`
    script += `        ELSE 'NO_EXISTE'\n`
    script += `    END as estado\n`
    script += `FROM EDESURFLX_SGD.UTRANSFORMADORA_LT \n`
    script += `WHERE instalacao IN (\n`

    allInstalaciones.forEach((item, index) => {
      script += `    '${item.instalacao}'${index < allInstalaciones.length - 1 ? ',' : ''}  -- ${item.circuito}\n`
    })

    script += `)\n`
    script += `GROUP BY instalacao\n`
    script += `ORDER BY instalacao;\n\n`

    script += `-- RESUMEN TOTAL\n`
    script += `SELECT \n`
    script += `    COUNT(*) as total_instalaciones,\n`
    script += `    SUM(CASE WHEN estado = 'EXISTE' THEN 1 ELSE 0 END) as existentes,\n`
    script += `    SUM(CASE WHEN estado = 'NO_EXISTE' THEN 1 ELSE 0 END) as no_existentes\n`
    script += `FROM (\n`
    script += `    SELECT \n`
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
    script += `) subquery;\n`

    setValidationScript(script)
  }

  // Generar mensaje amigable para el equipo
  const generateEmailMessage = (fileList: ProcessedFile[]) => {
    const totalInstalaciones = fileList.reduce((total, file) => total + file.instalaciones.length, 0)
    const circuitos = [...new Set(fileList.map(f => f.circuito))]
    
    const message = `Hola equipo de mantenimiento,

Necesitamos de su apoyo para ejecutar una actualización de polígonos y celdas en la base de datos.

📊 RESUMEN DE LA ACTUALIZACIÓN:
• Total de registros a actualizar: ${totalInstalaciones}
• Archivos procesados: ${fileList.length}
• Circuitos involucrados: ${circuitos.join(', ')}

🗄️ DETALLES TÉCNICOS:
• Base de datos: EDESURFLX_SGD
• Esquema: EDESURFLX_SGD
• Tabla: UTRANSFORMADORA_LT
• Campos a actualizar: cod_poligono, cod_celda

📁 ARCHIVOS INCLUIDOS:
${fileList.map((file, index) => `• ${index + 1}. ${file.name} (${file.instalaciones.length} instalaciones)`).join('\n')}

🔍 VALIDACIÓN REQUERIDA:
Se debe ejecutar primero el script de validación para verificar que todas las instalaciones existan en la tabla antes de proceder con la actualización.

Por favor, confírmenme cuando puedan proceder con esta tarea.

Saludos cordiales.`

    setEmailMessage(message)
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
    setEmailMessage('')
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
      generateEmailMessage(updatedFiles)
    } else {
      setCompressedContent('')
      setValidationScript('')
      setEmailMessage('')
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Upload className="w-4 h-4 mr-2" />
            Cargar Archivos
          </TabsTrigger>
          <TabsTrigger value="compressed" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <FileText className="w-4 h-4 mr-2" />
            Archivo General
          </TabsTrigger>
          <TabsTrigger value="validation" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Database className="w-4 h-4 mr-2" />
            Script Validación
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
            <Mail className="w-4 h-4 mr-2" />
            Mensaje para Mant
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
                            variant="outline" 
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
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
                <span>Archivo General</span>
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
                      Archivo general generado
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
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No hay archivo general</p>
                  <p className="text-sm">Carga archivos SQL en la pestaña "Cargar Archivos" para generar el archivo general</p>
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
                Script SQL simple para validar la existencia de instalaciones en UTRANSFORMADORA_LT
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

        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>Mensaje para Equipo de Mantenimiento</span>
              </CardTitle>
              <CardDescription>
                Mensaje amigable con detalles técnicos para solicitar la ejecución de la actualización
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {emailMessage ? (
                <>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">
                      Mensaje generado
                    </Badge>
                    <Button onClick={() => navigator.clipboard.writeText(emailMessage)} className="bg-orange-600 hover:bg-orange-700">
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar Mensaje
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <Textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="El mensaje se generará automáticamente al cargar archivos..."
                      className="min-h-[400px] font-mono text-sm"
                    />
                    
                    <div className="text-sm text-gray-600">
                      <p><strong>Nota:</strong> Puedes editar este mensaje antes de enviarlo al equipo de mantenimiento.</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No hay mensaje generado</p>
                  <p className="text-sm">Carga archivos SQL en la pestaña "Cargar Archivos" para generar el mensaje</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
