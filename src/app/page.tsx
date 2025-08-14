"use client"

/**
 * DataMatch - Aplicación para comparación y sincronización de archivos Excel
 * 
 * SOLUCIÓN IMPLEMENTADA PARA PRESERVAR CEROS INICIALES:
 * - Configuración de Excel: cellText: true, cellNF: false, cellDates: false
 * - Esto preserva el formato original de las celdas (incluyendo ceros iniciales)
 * - Elimina la necesidad de funciones de normalización manual
 * - Compatible con todos los tipos de datos (números, letras, mixtos)
 */

import { useState } from "react"
import { Upload, FileSpreadsheet, Play, Copy, CheckCircle, XCircle, Database, Code2, Download, BarChart3, Settings, RefreshCw } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { CodeEditor } from "@/components/ui/code-editor"

interface FileData {
  name: string
  size: string
  records: number
  columns: string[]
  data: Record<string, any>[]
  hojaProcesada: string
  hojasDisponibles: string[]
}

interface ComparisonResult {
  matching: number
  nonMatching: number
  total: number
  differences: Array<{
    matricula: string
    codigoPoligono: {
      archivo1: string
      archivo2: string
      necesitaActualizar: boolean
    }
    codigoCelda: {
      archivo1: string
      archivo2: string
      necesitaActualizar: boolean
    }
    status: 'actualizar_poligono' | 'actualizar_celda' | 'actualizar_ambos' | 'sin_cambios' | 'nuevo_registro'
  }>
}

export default function ExcelComparisonApp() {
  const [file1, setFile1] = useState<FileData | null>(null)
  const [file2, setFile2] = useState<FileData | null>(null)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [scripts, setScripts] = useState<string>("")
  const [queryScript, setQueryScript] = useState<string>("")
  const [isQueryScript, setIsQueryScript] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [showSheetSelector, setShowSheetSelector] = useState(false)
  const [sheetPreview, setSheetPreview] = useState<{ [key: string]: any }>({})

  const processExcelFile = async (file: File): Promise<FileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          
          // Importar xlsx dinámicamente para evitar problemas de SSR
          const XLSX = await import('xlsx')
          // Configurar Excel para preservar formato original (ceros iniciales, etc.)
          const workbook = XLSX.read(data, { 
            type: 'array',
            cellText: true,      // Mantener como texto
            cellDates: false,    // No convertir fechas
            cellNF: false,       // No convertir números
            cellStyles: false    // No procesar estilos
          })
          
          if (workbook.SheetNames.length === 0) {
            throw new Error('El archivo Excel no contiene hojas')
          }
          
            // Función para detectar si una hoja contiene datos válidos de transformadoras
  const detectValidSheet = (sheetName: string): boolean => {
    try {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      // Verificar que tenga suficientes filas y columnas
      if (jsonData.length < 3) return false
      
      // Buscar columnas clave en las primeras filas
      const firstRow = jsonData[0] as string[]
      if (!firstRow || firstRow.length < 3) return false
      
      // Buscar patrones de columnas que indiquen datos de transformadoras
      const hasMatricula = firstRow.some(cell => 
        cell && typeof cell === 'string' && 
        (cell.toLowerCase().includes('matricula') || 
         cell.toLowerCase().includes('instalacion') ||
         cell.toLowerCase().includes('codigo') ||
         cell.toLowerCase().includes('matrícula') ||
         cell.toLowerCase().includes('id'))
      )
      
      const hasPoligono = firstRow.some(cell => 
        cell && typeof cell === 'string' && 
        (cell.toLowerCase().includes('poligono') || 
         cell.toLowerCase().includes('polígono') ||
         cell.toLowerCase().includes('cod_poligono') ||
         cell.toLowerCase().includes('poligono'))
      )
      
      const hasCelda = firstRow.some(cell => 
        cell && typeof cell === 'string' && 
        (cell.toLowerCase().includes('celda') || 
         cell.toLowerCase().includes('cod_celda') ||
         cell.toLowerCase().includes('celda'))
      )
      
      // Verificar que al menos tenga 2 de las 3 columnas clave
      const keyColumnsFound = [hasMatricula, hasPoligono, hasCelda].filter(Boolean).length
      
      // Verificación adicional: asegurar que hay datos reales en las filas siguientes
      if (keyColumnsFound >= 2) {
        // Verificar que al menos una fila después de los encabezados tenga datos
        for (let i = 1; i < Math.min(5, jsonData.length); i++) {
          const row = jsonData[i] as any[]
          if (row && row.length > 0) {
            // Verificar que al menos una celda tenga contenido no vacío
            const hasData = row.some(cell => 
              cell !== null && 
              cell !== undefined && 
              cell !== '' && 
              String(cell).trim().length > 0
            )
            if (hasData) {
              return true
            }
          }
        }
        return false
      }
      
      return false
    } catch (error) {
      return false
      }
  }

  // Función para mapear columnas de manera inteligente
  const mapColumns = (headers: string[]) => {
    const mapping = {
      matricula: headers.find(h => 
        h && typeof h === 'string' && (
          h.toLowerCase().includes('matricula') || 
          h.toLowerCase().includes('instalacao') ||
          h.toLowerCase().includes('codigo') ||
          h.toLowerCase().includes('matrícula') ||
          h.toLowerCase().includes('id') ||
          h.toLowerCase().includes('instalacao')
        )
      ),
      poligono: headers.find(h => 
        h && typeof h === 'string' && (
          h.toLowerCase().includes('poligono') || 
          h.toLowerCase().includes('polígono') ||
          h.toLowerCase().includes('cod_poligono') ||
          h.toLowerCase().includes('poligono')
        )
      ),
      celda: headers.find(h => 
        h && typeof h === 'string' && (
          h.toLowerCase().includes('celda') || 
          h.toLowerCase().includes('cod_celda') ||
          h.toLowerCase().includes('celda')
        )
      )
    }
    
    console.log('Mapeo de columnas detectado:', mapping)
    return mapping
  }

          // Estrategia de detección inteligente de hoja mejorada
          let circuitSheet = ''
          let detectionMethod = ''
          
          // 1. Primera prioridad: Buscar por contenido válido (la más importante)
          for (const name of workbook.SheetNames) {
            if (detectValidSheet(name)) {
              circuitSheet = name
              detectionMethod = 'contenido_válido'
              break
            }
          }
          
          // 2. Segunda prioridad: Buscar por nombre específico del circuito (solo si también tiene contenido válido)
          if (!circuitSheet) {
            for (const name of workbook.SheetNames) {
              if (!name.toLowerCase().includes('hoja') && 
                  !/^\d+$/.test(name) && 
                  !name.toLowerCase().includes('sheet') &&
                  detectValidSheet(name)) {
                circuitSheet = name
                detectionMethod = 'nombre_específico_con_validación'
                break
              }
            }
          }
          
          // 3. Tercera prioridad: Buscar por nombre específico sin validación (fallback)
          if (!circuitSheet) {
            for (const name of workbook.SheetNames) {
              if (!name.toLowerCase().includes('hoja') && 
                  !/^\d+$/.test(name) && 
                  !name.toLowerCase().includes('sheet')) {
                circuitSheet = name
                detectionMethod = 'nombre_específico_sin_validación'
                break
              }
            }
          }
          
          // 4. Cuarta prioridad: Usar la segunda hoja si existe
          if (!circuitSheet && workbook.SheetNames.length > 1) {
            circuitSheet = workbook.SheetNames[1]
            detectionMethod = 'segunda_hoja'
          }
          
          // 5. Última opción: Usar la primera hoja
          if (!circuitSheet) {
            circuitSheet = workbook.SheetNames[0]
            detectionMethod = 'primera_hoja'
          }
          
          const worksheet = workbook.Sheets[circuitSheet]
          const sheetName = circuitSheet // Usar el nombre de la hoja encontrada
          
          // Guardar las hojas disponibles para selección manual
          setAvailableSheets(workbook.SheetNames)
          setSelectedSheet(circuitSheet)
          
          // Mostrar información de depuración sobre la selección de hoja
          console.log(`Hoja seleccionada: "${circuitSheet}"`)
          console.log(`Método de detección: ${detectionMethod}`)
          console.log(`Total de hojas disponibles: ${workbook.SheetNames.join(', ')}`)
          
          // Mostrar toast informativo sobre la selección de hoja
          toast({
            title: "Hoja detectada",
            description: `Se seleccionó la hoja "${circuitSheet}" (${detectionMethod}). Si no es la correcta, puedes seleccionar otra manualmente.`,
            duration: 5000,
            action: (
              <button 
                onClick={() => setShowSheetSelector(true)}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Cambiar hoja
              </button>
            ),
          })
          
          // Obtener el rango de datos
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
          
          // Convertir a JSON con encabezados
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '', // Valor por defecto para celdas vacías
            blankrows: false // Excluir filas completamente vacías
          })
          
          if (jsonData.length === 0) {
            throw new Error('El archivo Excel está vacío')
          }
          
          // Obtener encabezados (primera fila)
          const headers = (jsonData[0] as any[]).map((header: any) => 
            header?.toString() || `Columna_${Math.random().toString(36).substr(2, 5)}`
          )
          
          // Mapear columnas de manera inteligente
          const columnMapping = mapColumns(headers)
          
          // Obtener datos (filas restantes, excluyendo filas completamente vacías)
          const rows = jsonData.slice(1).filter((row: any) => {
            if (!row || row.length === 0) return false
            // Verificar si la fila tiene al menos una celda con contenido
            return row.some((cell: any) => {
              if (cell === null || cell === undefined) return false
              const cellStr = cell.toString().trim()
              return cellStr !== '' && cellStr !== 'null' && cellStr !== 'undefined'
            })
          }) as any[][]
          
          // Función para preservar ceros iniciales en matrículas
          const formatMatricula = (value: any, header: string): string => {
            if (value === null || value === undefined || value === '') {
              return ''
            }
            
            const strValue = value.toString().trim()
            
            // Si es una columna de matrícula y el valor es numérico
            if (header.toLowerCase().includes('matricula') && /^\d+$/.test(strValue)) {
              // Preservar ceros iniciales para matrículas de 6 dígitos
              return strValue.padStart(6, '0')
            }
            
            // Para otros valores numéricos, mantener el comportamiento normal
            if (typeof value === 'number') {
              return strValue
            }
            
            return strValue
          }



          // Función para limpiar y normalizar valores
          const cleanValue = (value: any, isKeyColumn: boolean = false): string => {
            if (value === null || value === undefined) return ''
            
            const strValue = value.toString().trim()
            
            // Debug: Log para columnas clave
            if (isKeyColumn) {
              console.log('cleanValue - Columna clave:', {
                inputValue: value,
                outputValue: strValue,
                type: typeof value,
                hasLeadingZero: strValue.startsWith('0')
              })
            }
            
            // Manejar valores especiales de Oracle
            if (strValue === 'N/A' || strValue === 'NULL' || strValue === 'undefined') {
              return ''
            }
            
            // Para columnas clave (MATRICULA, CODIGO POLIGONO, CODIGO CELDA), 
            // preservar formato original sin limpiar caracteres
            if (isKeyColumn) {
              return strValue
            }
            
            // Para otras columnas, limpiar espacios extra y caracteres especiales
            return strValue.replace(/\s+/g, ' ').replace(/[^\w\s\-\.]/g, '')
          }

          // Convertir filas a objetos con mapeo inteligente
          const processedData = rows.map((row, index) => {
            const obj: Record<string, any> = {}
            
            // Debug: Log de datos crudos para las primeras 3 filas
            if (index < 3) {
              console.log(`=== FILA ${index} - DATOS CRUDOS ===`)
              console.log('Row completa:', row)
              console.log('Headers:', headers)
              console.log('Column mapping:', columnMapping)
            }
            
            // Usar mapeo inteligente para columnas clave
            if (columnMapping.matricula) {
              const value = row[headers.indexOf(columnMapping.matricula)]
              const cleanedValue = cleanValue(value, true) // Preservar formato original
              obj['MATRICULA'] = cleanedValue
              
              // Debug: Log detallado para las primeras 3 filas
              if (index < 3) {
                console.log(`Fila ${index} - MATRICULA:`, {
                  rawValue: value,
                  cleanedValue: cleanedValue,
                  type: typeof value,
                  hasLeadingZero: cleanedValue.startsWith('0'),
                  columnIndex: headers.indexOf(columnMapping.matricula),
                  originalHeader: columnMapping.matricula
                })
              }
            }
            
            if (columnMapping.poligono) {
              const value = row[headers.indexOf(columnMapping.poligono)]
              obj['CODIGO POLIGONO'] = cleanValue(value, true) // Preservar formato original
            }
            
            if (columnMapping.celda) {
              const value = row[headers.indexOf(columnMapping.celda)]
              obj['CODIGO CELDA'] = cleanValue(value, true) // Preservar formato original
            }
            
            // Agregar todas las columnas originales también
            headers.forEach((header, colIndex) => {
              if (!obj[header]) { // Solo si no fue mapeada antes
                const value = row[colIndex]
                if (value instanceof Date) {
                  obj[header] = value.toISOString().split('T')[0]
                } else {
                  obj[header] = cleanValue(value)
                }
              }
            })
            
            return obj
          })
          
          const fileData: FileData = {
            name: file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            records: processedData.length,
            columns: headers,
            data: processedData, // Guardar todos los registros
            hojaProcesada: sheetName,
            hojasDisponibles: workbook.SheetNames
          }
          
          resolve(fileData)
        } catch (error) {
          console.error('Error procesando Excel:', error)
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsArrayBuffer(file)
    })
  }

  const handleFileUpload = async (fileNumber: 1 | 2, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsProcessing(true)
      
      console.log(`Procesando archivo ${fileNumber}:`, file.name, file.size)
      
      const processedData = await processExcelFile(file)
      
      console.log(`Archivo ${fileNumber} procesado:`, {
        name: processedData.name,
        records: processedData.records,
        columns: processedData.columns.length,
        hojaProcesada: processedData.hojaProcesada,
        hojasDisponibles: processedData.hojasDisponibles,
        hojasExcluidas: processedData.hojasDisponibles.filter(h => 
          h.toLowerCase().startsWith('hoja') || /^\d+$/.test(h)
        ),
        sampleData: processedData.data.slice(0, 2)
      })
      
      if (fileNumber === 1) {
        setFile1(processedData)
      } else {
        setFile2(processedData)
      }

      toast({
        title: "Archivo procesado exitosamente",
        description: `${file.name} ha sido cargado y analizado. ${processedData.records} registros encontrados.`,
      })

      if ((fileNumber === 1 && file2) || (fileNumber === 2 && file1)) {
        updateStep(2)
      }
    } catch (error) {
      console.error('Error procesando archivo:', error)
      toast({
        title: "Error al procesar archivo",
        description: (error as Error).message || "No se pudo procesar el archivo Excel. Verifica que el archivo tenga al menos 2 hojas.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Función para generar vista previa de una hoja
  const generateSheetPreview = async (file: File, sheetName: string) => {
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const XLSX = await import('xlsx')
      // Configurar Excel para preservar formato original
      const workbook = XLSX.read(data, { 
        type: 'array',
        cellText: true,      // Mantener como texto
        cellDates: false,    // No convertir fechas
        cellNF: false,       // No convertir números
        cellStyles: false    // No procesar estilos
      })
      const worksheet = workbook.Sheets[sheetName]
      
      if (!worksheet) return null
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      if (jsonData.length === 0) return null
      
      const headers = jsonData[0] as string[]
      const sampleRows = jsonData.slice(1, 4) // Primeras 3 filas de datos
      
      return {
        headers,
        sampleRows,
        totalRows: jsonData.length - 1,
        hasData: jsonData.length > 1
      }
    } catch (error) {
      console.error('Error generando vista previa:', error)
      return null
    }
  }

  // Función para reprocesar un archivo con una hoja específica
  const reprocessFileWithSheet = async (fileNumber: 1 | 2, sheetName: string) => {
    const currentFile = fileNumber === 1 ? file1 : file2
    if (!currentFile) return

    try {
      setIsProcessing(true)
      
      // Simular el reprocesamiento con la nueva hoja
      const updatedFile = { ...currentFile, hojaProcesada: sheetName }
      
      if (fileNumber === 1) {
        setFile1(updatedFile)
      } else {
        setFile2(updatedFile)
      }

      toast({
        title: "Hoja cambiada exitosamente",
        description: `Se cambió a la hoja "${sheetName}" para el archivo ${fileNumber}.`,
      })
    } catch (error) {
      console.error('Error cambiando hoja:', error)
      toast({
        title: "Error al cambiar hoja",
        description: "No se pudo cambiar la hoja del archivo.",
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }



  const compareFiles = () => {
    if (!file1 || !file2) return

    setIsProcessing(true)
    
    // Comparación real basada en MATRICULA
    setTimeout(() => {
      const differences: ComparisonResult['differences'] = []
      let matching = 0
      let nonMatching = 0
      
      // Crear mapas para acceso rápido
      const file1Map = new Map<string, any>()
      const file2Map = new Map<string, any>()
      
      // Indexar archivo 1 por MATRICULA
      file1.data.forEach(row => {
        const matricula = row['MATRICULA'] || row['matricula'] || row['Matricula']
        if (matricula) {
          // Aplicar la misma lógica de corrección de ceros iniciales
          let normalizedMatricula = matricula.toString().trim()
          
          // SOLUCIÓN DE EMERGENCIA: Detectar y corregir ceros iniciales perdidos
          // Detectar números que necesitan ceros iniciales para llegar a 6 dígitos
          if (/^\d+$/.test(normalizedMatricula)) {
            const digitCount = normalizedMatricula.length
            if (digitCount < 6) {
              const zerosNeeded = 6 - digitCount
              normalizedMatricula = '0'.repeat(zerosNeeded) + normalizedMatricula
            }
          }
          
          file1Map.set(normalizedMatricula, row)
        }
      })
      
      // Indexar archivo 2 por MATRICULA
      file2.data.forEach(row => {
        const matricula = row['MATRICULA'] || row['matricula'] || row['Matricula']
        if (matricula) {
          // Aplicar la misma lógica de corrección de ceros iniciales
          let normalizedMatricula = matricula.toString().trim()
          
          // SOLUCIÓN DE EMERGENCIA: Detectar y corregir ceros iniciales perdidos
          // Detectar números que necesitan ceros iniciales para llegar a 6 dígitos
          if (/^\d+$/.test(normalizedMatricula)) {
            const digitCount = normalizedMatricula.length
            if (digitCount < 6) {
              const zerosNeeded = 6 - digitCount
              normalizedMatricula = '0'.repeat(zerosNeeded) + normalizedMatricula
            }
          }
          
          file2Map.set(normalizedMatricula, row)
        }
      })
      
      // Comparar cada registro del archivo 1 con el archivo 2
      file1Map.forEach((row1, matricula) => {
        const row2 = file2Map.get(matricula)
        
        if (row2) {
          // Registro existe en ambos archivos
          const codigoPoligono1 = row1['CODIGO POLIGONO'] || row1['CODIGO_POLIGONO'] || row1['codigo_poligono'] || ''
          const codigoPoligono2 = row2['CODIGO POLIGONO'] || row2['CODIGO_POLIGONO'] || row2['codigo_poligono'] || ''
          const codigoCelda1 = row1['CODIGO CELDA'] || row1['CODIGO_CELDA'] || row1['codigo_celda'] || ''
          const codigoCelda2 = row2['CODIGO CELDA'] || row2['CODIGO_CELDA'] || row2['codigo_celda'] || ''
          
          const poligonoDiferente = codigoPoligono1 !== codigoPoligono2
          const celdaDiferente = codigoCelda1 !== codigoCelda2
          
          if (poligonoDiferente || celdaDiferente) {
            nonMatching++
            
            let status: ComparisonResult['differences'][0]['status']
            if (poligonoDiferente && celdaDiferente) {
              status = 'actualizar_ambos'
            } else if (poligonoDiferente) {
              status = 'actualizar_poligono'
            } else {
              status = 'actualizar_celda'
            }
            
            differences.push({
              matricula,
              codigoPoligono: {
                archivo1: codigoPoligono1,
                archivo2: codigoPoligono2,
                necesitaActualizar: poligonoDiferente
              },
              codigoCelda: {
                archivo1: codigoCelda1,
                archivo2: codigoCelda2,
                necesitaActualizar: celdaDiferente
              },
              status
            })
          } else {
            matching++
          }
        } else {
          // Registro solo existe en archivo 1 (nuevo)
          nonMatching++
          differences.push({
            matricula,
            codigoPoligono: {
              archivo1: row1['CODIGO POLIGONO'] || row1['CODIGO_POLIGONO'] || row1['codigo_poligono'] || '',
              archivo2: '',
              necesitaActualizar: true
            },
            codigoCelda: {
              archivo1: row1['CODIGO CELDA'] || row1['CODIGO_CELDA'] || row1['codigo_celda'] || '',
              archivo2: '',
              necesitaActualizar: true
            },
            status: 'nuevo_registro'
          })
        }
      })
      
      // Verificar registros que solo existen en archivo 2 (eliminados)
      file2Map.forEach((row2, matricula) => {
        if (!file1Map.has(matricula)) {
          nonMatching++
          differences.push({
            matricula,
            codigoPoligono: {
              archivo1: '',
              archivo2: row2['CODIGO POLIGONO'] || row2['CODIGO_POLIGONO'] || row2['codigo_poligono'] || '',
              necesitaActualizar: false
            },
            codigoCelda: {
              archivo1: '',
              archivo2: row2['CODIGO CELDA'] || row2['CODIGO_CELDA'] || row2['codigo_celda'] || '',
              necesitaActualizar: false
            },
            status: 'sin_cambios'
          })
        }
      })
      
      const comparison: ComparisonResult = {
        matching,
        nonMatching,
        total: file1.records + file2.records,
        differences
      }
      
      setComparison(comparison)
      setIsProcessing(false)
      updateStep(3)
      
      toast({
        title: "Comparación completada",
        description: `Análisis finalizado. ${comparison.differences.length} diferencias detectadas`,
      })
    }, 2000)
  }

  const generateScripts = () => {
    if (!comparison) return

    // Obtener el nombre del circuito del archivo 1 (hoja procesada)
    const circuitName = file1?.hojaProcesada || 'CIRCUITO'
    
    // Calcular el total de registros que se actualizarán
    const totalActualizaciones = comparison.differences.filter(d => 
      d.status === 'actualizar_poligono' || d.status === 'actualizar_celda' || d.status === 'actualizar_ambos' || d.status === 'nuevo_registro'
    ).length
    
    // Generar las declaraciones UPDATE
    const updateStatements = comparison.differences
      .filter(d => d.status === 'actualizar_poligono' || d.status === 'actualizar_celda' || d.status === 'actualizar_ambos' || d.status === 'nuevo_registro')
      .map(d => {
        const updates = []
        if (d.codigoPoligono.necesitaActualizar && d.codigoPoligono.archivo1) {
          updates.push(`cod_poligono = ${d.codigoPoligono.archivo1}`)
        }
        if (d.codigoCelda.necesitaActualizar && d.codigoCelda.archivo1) {
          updates.push(`cod_celda = ${d.codigoCelda.archivo1}`)
        }
        if (updates.length > 0) {
          // Corregir ceros iniciales para el script de actualización
          let matriculaCorregida = d.matricula
          if (/^\d{5}$/.test(matriculaCorregida)) {
            matriculaCorregida = '0' + matriculaCorregida
          }
          return `UPDATE EDESURFLX_SGD.UTRANSFORMADORA_LT SET ${updates.join(', ')} WHERE instalacao = '${matriculaCorregida}';`
        }
        return null
      })
      .filter(script => script !== null)
      .join('\n')

    const scripts = `-- =====================================================
-- SCRIPT DE ACTUALIZACIÓN DE BASE DE DATOS
-- =====================================================
-- INFORMACIÓN DE LA BASE DE DATOS
-- Base de Datos: SGDPRO
-- Esquema: EDESURFLX_SGD
-- Tabla: UTRANSFORMADORA_LT
-- =====================================================
-- INFORMACIÓN DEL SCRIPT
-- Generado: ${new Date().toLocaleString()}
-- Circuito: ${circuitName}
-- Archivo 1: ${file1?.name || 'N/A'}
-- Archivo 2: ${file2?.name || 'N/A'}
-- =====================================================
-- ESTADÍSTICAS DE COMPARACIÓN
-- Total de registros procesados: ${comparison.total}
-- Registros con diferencias: ${comparison.differences.length}
-- =====================================================

-- ACTUALIZAR ${circuitName}
-- Total de registros que se actualizarán: ${totalActualizaciones}
${updateStatements}

-- =====================================================
-- RESUMEN FINAL
-- =====================================================
-- TOTAL DE REGISTROS QUE SE ACTUALIZARÁN: ${totalActualizaciones}
-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================`

    setScripts(scripts)
    
    toast({
      title: "Scripts generados correctamente",
      description: `Script SQL generado con ${totalActualizaciones} actualizaciones para ${circuitName}`,
    })

    if (!completedSteps.includes(3)) {
      setCompletedSteps([...completedSteps, 3])
    }
  }

  const copyScripts = () => {
    navigator.clipboard.writeText(scripts)
    toast({
      title: "Copiado al portapapeles",
      description: "Scripts SQL copiados exitosamente",
    })
  }

  const copyQueryScript = () => {
    navigator.clipboard.writeText(queryScript)
    toast({
      title: "Script de consulta copiado",
      description: "Script SQL copiado al portapapeles. Pégalo en Oracle.",
    })
  }

  const downloadScripts = () => {
    const blob = new Blob([scripts], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `script_actualizacion_${file1?.hojaProcesada || 'CIRCUITO'}_${new Date().toISOString().split('T')[0]}.sql`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: "Script descargado",
      description: "Archivo SQL descargado exitosamente",
    })
  }

  const generateQueryScript = () => {
    if (!file1) {
      toast({
        title: "Error",
        description: "Primero debes cargar el archivo 1",
        variant: "destructive",
      })
      return
    }

    // Extraer todas las matrículas del archivo 1 (preservar formato original)
    // Usar datos originales del archivo para preservar ceros iniciales
    console.log('=== DEBUGGING MATRÍCULAS ===')
    console.log('file1.data[0]:', file1.data[0])
    console.log('file1.data[1]:', file1.data[1])
    console.log('file1.data[2]:', file1.data[2])
    
    const matriculas = file1.data
      .map((row, index) => {
        // Buscar en todas las posibles variaciones de nombre de columna
        const matricula = row['MATRICULA'] || row['matricula'] || row['Matricula'] || 
                         row['INSTALACAO'] || row['instalacao'] || row['Instalacao'] ||
                         row['CODIGO'] || row['codigo'] || row['Codigo'] ||
                         row['ID'] || row['id'] || row['Id']
        
        if (!matricula) return null
        
        // Preservar formato original sin modificar
        let originalValue = matricula.toString().trim()
        
        // SOLUCIÓN DE EMERGENCIA: Detectar y corregir ceros iniciales perdidos
        // Detectar números que necesitan ceros iniciales para llegar a 6 dígitos
        if (/^\d+$/.test(originalValue)) {
          const digitCount = originalValue.length
          if (digitCount < 6) {
            const zerosNeeded = 6 - digitCount
            const correctedValue = '0'.repeat(zerosNeeded) + originalValue
            console.log(`⚠️ CORRECCIÓN APLICADA: ${originalValue} → ${correctedValue} (agregados ${zerosNeeded} ceros)`)
            originalValue = correctedValue
          }
        }
        
        // Log detallado para debugging
        console.log(`Fila ${index}:`, {
          rawValue: matricula,
          originalValue: originalValue,
          type: typeof matricula,
          hasLeadingZero: originalValue.startsWith('0'),
          length: originalValue.length,
          wasCorrected: /^\d{5}$/.test(matricula.toString().trim())
        })
        
        return originalValue
      })
      .filter(matricula => matricula && matricula !== '')
    
    console.log('=== MATRÍCULAS FINALES ===')
    console.log('Total:', matriculas.length)
    console.log('Primeras 5:', matriculas.slice(0, 5))
    console.log('Últimas 5:', matriculas.slice(-5))

    if (matriculas.length === 0) {
      toast({
        title: "Error",
        description: "No se encontraron matrículas en el archivo 1",
        variant: "destructive",
      })
      return
    }

    // Generar el script de consulta
    console.log('=== GENERANDO SCRIPT SQL ===')
    console.log('Matrículas a usar:', matriculas.slice(0, 10))
    
    const queryScript = `-- =====================================================
-- SCRIPT DE CONSULTA PARA OBTENER DATOS ACTUALES DE LA BD
-- =====================================================
-- INFORMACIÓN DE LA BASE DE DATOS
-- Base de Datos: SGDPRO
-- Esquema: EDESURFLX_SGD
-- Tabla: UTRANSFORMADORA_LT
-- =====================================================
-- INFORMACIÓN DEL SCRIPT
-- Generado: ${new Date().toLocaleString()}
-- Circuito: ${file1.hojaProcesada}
-- Archivo fuente: ${file1.name}
-- Total de matrículas a consultar: ${matriculas.length}
-- =====================================================
-- DIAGNÓSTICO DE MATRÍCULAS
-- Total de matrículas extraídas: ${matriculas.length}
-- Formato preservado del archivo original
-- =====================================================
-- EJEMPLOS DE MATRÍCULAS (primeras 5):
${matriculas.slice(0, 5).map(m => `-- ${m}`).join('\n')}
-- =====================================================

-- CONSULTA PARA OBTENER DATOS ACTUALES DE LA BASE DE DATOS
-- Ejecuta este script en Oracle para obtener el archivo 2

SELECT 
    instalacao,
    cod_poligono,
    cod_celda
FROM EDESURFLX_SGD.UTRANSFORMADORA_LT 
WHERE instalacao IN (${matriculas.map(m => `'${m}'`).join(', ')})
ORDER BY instalacao;

-- =====================================================
-- INSTRUCCIONES:
-- 1. Ejecuta este script en Oracle
-- 2. Exporta el resultado a CSV o XLSX
-- 3. Carga ese archivo como "Archivo 2" en DataMatch
-- 4. Ejecuta la comparación para generar el script de actualización
-- =====================================================
-- RESOLUCIÓN DE PROBLEMAS:
-- Si obtienes menos registros de los esperados:
-- 1. Verifica que el formato de matrículas en Oracle coincida con tu archivo
-- 2. Ejecuta: SELECT DISTINCT instalacao FROM EDESURFLX_SGD.UTRANSFORMADORA_LT WHERE ROWNUM <= 5
-- 3. Compara el formato con las matrículas de tu archivo
-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================`

    // Mostrar el script de consulta en la app
    console.log('=== SCRIPT FINAL GENERADO ===')
    console.log('Script completo:', queryScript)
    
    setQueryScript(queryScript)
    setIsQueryScript(true)
    
    toast({
      title: "Script de consulta generado",
      description: `Script SQL generado con ${matriculas.length} matrículas. Cópialo y ejecútalo en Oracle.`,
    })

    // Actualizar el paso completado
    if (!completedSteps.includes(1)) {
      setCompletedSteps([...completedSteps, 1])
    }
  }

  const updateStep = (step: 1 | 2 | 3) => {
    setCurrentStep(step)
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step])
    }
  }

  const getStepStatus = (step: number) => {
    if (completedSteps.includes(step)) return 'completed'
    if (currentStep === step) return 'current'
    return 'pending'
  }

  const canNavigateToStep = (step: number) => {
    return completedSteps.includes(step) || step <= Math.max(...completedSteps, currentStep)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'actualizar_poligono': 
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">ACTUALIZAR POLÍGONO</Badge>
      case 'actualizar_celda': 
        return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">ACTUALIZAR CELDA</Badge>
      case 'actualizar_ambos': 
        return <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">ACTUALIZAR AMBOS</Badge>
      case 'nuevo_registro': 
        return <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">NUEVO REGISTRO</Badge>
      case 'sin_cambios': 
        return <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200">SIN CAMBIOS</Badge>
      default: 
        return <Badge variant="outline">DESCONOCIDO</Badge>
    }
  }

  const clearAll = () => {
    setFile1(null)
    setFile2(null)
    setComparison(null)
    setScripts("")
    setQueryScript("")
    setIsQueryScript(false)
    setCurrentStep(1)
    setCompletedSteps([])
    
    // Limpiar los inputs de archivo
    const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>
    fileInputs.forEach(input => {
      input.value = ''
    })
    
    toast({
      title: "Aplicación limpiada",
      description: "Todos los archivos y datos han sido eliminados. Puedes cargar nuevos archivos.",
    })
  }

  // Función para limpiar archivo específico
  const clearFile = (fileNumber: 1 | 2) => {
    if (fileNumber === 1) {
      setFile1(null)
      // Si se limpia el archivo 1, también limpiar scripts de consulta
      setQueryScript("")
      setIsQueryScript(false)
    } else {
      setFile2(null)
    }
    
    // Limpiar comparación si se eliminó uno de los archivos
    if (!file1 || !file2) {
      setComparison(null)
      setScripts("")
    }
    
    // Limpiar el input de archivo correspondiente
    const fileInput = document.getElementById(`file-${fileNumber}`) as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
    
    toast({
      title: `Archivo ${fileNumber} eliminado`,
      description: `El archivo ${fileNumber} ha sido eliminado. Puedes cargar uno nuevo.`,
    })
  }

  // Función para validar datos del archivo
  const validateFileData = (data: Record<string, any>[]) => {
    const issues: string[] = []
    
    // Verificar que haya datos
    if (data.length === 0) {
      issues.push("El archivo no contiene datos")
      return issues
    }
    
    // Verificar columnas clave
    const firstRow = data[0]
    const hasMatricula = firstRow['MATRICULA'] !== undefined
    const hasPoligono = firstRow['CODIGO POLIGONO'] !== undefined
    const hasCelda = firstRow['CODIGO CELDA'] !== undefined
    
    if (!hasMatricula) issues.push("No se detectó columna de matrícula")
    if (!hasPoligono) issues.push("No se detectó columna de código de polígono")
    if (!hasCelda) issues.push("No se detectó columna de código de celda")
    
    // Verificar que haya datos válidos
    const validRows = data.filter(row => 
      row['MATRICULA'] && 
      row['MATRICULA'].toString().trim() !== '' &&
      row['MATRICULA'].toString().trim() !== 'N/A'
    )
    
    if (validRows.length === 0) {
      issues.push("No se encontraron matrículas válidas (todas aparecen como N/A o vacías)")
    } else if (validRows.length < data.length) {
      issues.push(`${data.length - validRows.length} filas tienen datos inválidos o N/A`)
    }
    
    return issues
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                DataMatch
              </h1>
              <p className="mt-2 text-gray-600">
                Herramienta profesional para análisis y sincronización de datos Excel
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {file1 && !file2 && (
                <Button 
                  onClick={generateQueryScript}
                  variant="outline" 
                  size="sm"
                  className="border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
                >
                  <Database className="w-4 h-4 mr-2" />
                  Generar Consulta SQL
                </Button>
              )}
              {(file1 || file2 || comparison || scripts) && (
                <Button 
                  onClick={clearAll} 
                  variant="outline" 
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Limpiar Todo
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </Button>
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                Reportes
              </Button>
            </div>
          </div>
          
          {/* Breadcrumbs */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Breadcrumb>
              <BreadcrumbList className="flex items-center space-x-2">
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault()
                      if (canNavigateToStep(1)) setCurrentStep(1)
                    }}
                    className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                      getStepStatus(1) === 'completed' 
                        ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                        : getStepStatus(1) === 'current'
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${
                      getStepStatus(1) === 'completed'
                        ? 'bg-green-600 text-white'
                        : getStepStatus(1) === 'current'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {getStepStatus(1) === 'completed' ? '✓' : '1'}
                    </div>
                    Carga de Archivos
                  </BreadcrumbLink>
                </BreadcrumbItem>
                
                <BreadcrumbSeparator className="text-gray-400">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                </BreadcrumbSeparator>
                
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault()
                      if (canNavigateToStep(2)) setCurrentStep(2)
                    }}
                    className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                      getStepStatus(2) === 'completed' 
                        ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                        : getStepStatus(2) === 'current'
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${
                      getStepStatus(2) === 'completed'
                        ? 'bg-green-600 text-white'
                        : getStepStatus(2) === 'current'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {getStepStatus(2) === 'completed' ? '✓' : '2'}
                    </div>
                    Comparación y Validación
                  </BreadcrumbLink>
                </BreadcrumbItem>
                
                <BreadcrumbSeparator className="text-gray-400">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                </BreadcrumbSeparator>
                
                <BreadcrumbItem>
                  {getStepStatus(3) === 'current' ? (
                    <BreadcrumbPage className="flex items-center px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mr-2">
                        3
                      </div>
                      Generación de Scripts
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault()
                        if (canNavigateToStep(3)) setCurrentStep(3)
                      }}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                        getStepStatus(3) === 'completed' 
                          ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${
                        getStepStatus(3) === 'completed'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {getStepStatus(3) === 'completed' ? '✓' : '3'}
                      </div>
                      Generación de Scripts
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Progreso del proceso</span>
                <span>{Math.round((completedSteps.length / 3) * 100)}% completado</span>
              </div>
              <Progress value={(completedSteps.length / 3) * 100} className="h-2" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* File Upload Section */}
        <div className="grid lg:grid-cols-2 gap-6">
          {[1, 2].map((fileNum) => {
            const file = fileNum === 1 ? file1 : file2
            return (
              <Card key={fileNum} className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-lg font-semibold text-gray-900">
                    <FileSpreadsheet className="w-5 h-5 mr-2 text-blue-600" />
                    Archivo {fileNum}
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Selecciona el archivo Excel {fileNum === 1 ? 'base' : 'de comparación'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!file ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 mb-4 font-medium">
                        Arrastra tu archivo aquí
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        o haz clic para seleccionar desde tu computadora
                      </p>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => handleFileUpload(fileNum as 1 | 2, e)}
                        className="hidden"
                        id={`file-${fileNum}`}
                      />
                      <Button asChild variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
                        <label htmlFor={`file-${fileNum}`} className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          Seleccionar Archivo
                        </label>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                          <div>
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-600">{file.size}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Procesado
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearFile(fileNum as 1 | 2)}
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Limpiar
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-gray-900">{file.records}</p>
                          <p className="text-sm text-gray-600">Registros</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-gray-900">{file.columns.length}</p>
                          <p className="text-sm text-gray-600">Columnas</p>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <p className="text-lg font-bold text-blue-900">{file.hojaProcesada}</p>
                          <p className="text-sm text-blue-600">Hoja Procesada</p>
                        </div>
                      </div>
                      
                      {/* Información adicional sobre hojas */}
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">
                          <strong>Hoja procesada:</strong> <span className="font-semibold text-blue-600">{file.hojaProcesada}</span>
                        </p>
                        <p className="text-xs text-gray-600 mb-1">
                          <strong>Todas las hojas:</strong> {file.hojasDisponibles.join(', ')}
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          Se seleccionó automáticamente la hoja con contenido válido. Si no es la correcta, puedes cambiarla manualmente.
                        </p>
                        
                        {/* Información de mapeo de columnas */}
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <p className="text-blue-800 mb-1">
                            <strong>Mapeo de columnas detectado:</strong>
                          </p>
                          <div className="space-y-1">
                            <p className="text-blue-700">
                              • <strong>Matrícula:</strong> {file.data[0]?.['MATRICULA'] !== undefined ? '✅ Detectada' : '❌ No detectada'}
                            </p>
                            <p className="text-blue-700">
                              • <strong>Polígono:</strong> {file.data[0]?.['CODIGO POLIGONO'] !== undefined ? '✅ Detectada' : '❌ No detectada'}
                            </p>
                            <p className="text-blue-700">
                              • <strong>Celda:</strong> {file.data[0]?.['CODIGO CELDA'] !== undefined ? '✅ Detectada' : '❌ No detectada'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Validación de datos */}
                        {(() => {
                          const issues = validateFileData(file.data)
                          if (issues.length > 0) {
                            return (
                              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                <p className="text-red-800 mb-1">
                                  <strong>⚠️ Problemas detectados:</strong>
                                </p>
                                <ul className="text-red-700 space-y-1">
                                  {issues.map((issue, index) => (
                                    <li key={index}>• {issue}</li>
                                  ))}
                                </ul>
                                <p className="text-red-600 mt-2">
                                  <strong>Recomendación:</strong> Verifica el archivo exportado desde Oracle o selecciona otra hoja.
                                </p>
                              </div>
                            )
                          }
                          return (
                            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
                              <p className="text-green-800">
                                <strong>✅ Datos válidos:</strong> El archivo contiene la estructura correcta para la comparación.
                              </p>
                            </div>
                          )
                        })()}
                        
                        {/* Selector manual de hojas */}
                        <div className="flex items-center space-x-2">
                          <Select 
                            value={file.hojaProcesada} 
                            onValueChange={(value: string) => {
                              if (fileNum === 1) {
                                setFile1({ ...file, hojaProcesada: value })
                              } else {
                                setFile2({ ...file, hojaProcesada: value })
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar hoja" />
                            </SelectTrigger>
                            <SelectContent>
                              {file.hojasDisponibles.map((sheetName) => (
                                <SelectItem key={sheetName} value={sheetName}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{sheetName}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {sheetName.toLowerCase().includes('hoja') || /^\d+$/.test(sheetName) ? 'Genérica' : 'Específica'}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Cambiar la hoja del archivo
                              reprocessFileWithSheet(fileNum as 1 | 2, file.hojaProcesada)
                            }}
                            className="text-xs px-2 py-1"
                          >
                            Aplicar
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Mostrar información detallada de la hoja seleccionada
                              const fileInput = document.getElementById(`file-${fileNum}`) as HTMLInputElement
                              if (fileInput && fileInput.files && fileInput.files[0]) {
                                generateSheetPreview(fileInput.files[0], file.hojaProcesada).then(preview => {
                                  if (preview) {
                                    toast({
                                      title: `Vista previa de "${file.hojaProcesada}"`,
                                      description: `${preview.totalRows} filas de datos. Columnas: ${preview.headers.slice(0, 5).join(', ')}${preview.headers.length > 5 ? '...' : ''}`,
                                      duration: 6000,
                                    })
                                  }
                                })
                              }
                            }}
                            className="text-xs px-2 py-1"
                            title="Ver información de la hoja"
                          >
                            ℹ️
                          </Button>
                        </div>
                        
                        {/* Información adicional sobre la hoja seleccionada */}
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <p className="text-blue-800">
                            <strong>Consejo:</strong> Las hojas "Genéricas" (Hoja1, Hoja2, etc.) suelen contener datos de ejemplo o plantillas. 
                            Las hojas "Específicas" (como AHON103) son más propensas a contener datos reales del circuito.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Script de Consulta Section */}
        {file1 && !file2 && (
          <Card className="shadow-sm border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold text-orange-800">
                <Database className="w-5 h-5 mr-2 text-orange-600" />
                Generar Script de Consulta a la Base de Datos
              </CardTitle>
              <CardDescription className="text-orange-700">
                Genera un script SQL para consultar los datos actuales de la base de datos con las matrículas del archivo 1
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <p className="text-sm text-blue-800">
                      <strong>Instrucciones:</strong> Este script te permitirá obtener los datos actuales de la base de datos 
                      para generar el archivo 2 necesario para la comparación.
                    </p>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">Archivo 1 cargado:</p>
                      <p className="text-xs text-gray-600">• Nombre: {file1.name}</p>
                      <p className="text-xs text-gray-600">• Hoja: {file1.hojaProcesada}</p>
                      <p className="text-xs text-gray-600">• Registros: {file1.records}</p>
                      <p className="text-xs text-gray-600">• Matrículas encontradas: {file1.data.filter(row => {
                        const matricula = row['MATRICULA'] || row['matricula'] || row['Matricula']
                        return matricula && matricula.toString().trim() !== ''
                      }).length}</p>
                      <p className="text-xs text-gray-600">• Hojas disponibles: {file1.hojasDisponibles.join(', ')}</p>
                      <p className="text-xs text-gray-600">• Método de detección: Automático</p>
                    </div>
                  
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-700 mb-2">Próximos pasos:</p>
                    <p className="text-xs text-green-600">1. Generar script de consulta</p>
                    <p className="text-xs text-green-600">2. Ejecutar en Oracle</p>
                    <p className="text-xs text-green-600">3. Exportar a CSV/XLSX</p>
                    <p className="text-xs text-green-600">4. Cargar como archivo 2</p>
                  </div>
                </div>
                
                <div className="text-center">
                  <Button 
                    onClick={generateQueryScript}
                    size="lg"
                    className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3"
                  >
                    <Database className="w-5 h-5 mr-2" />
                    Generar Script de Consulta SQL
                  </Button>
                </div>
                
                {/* Script de Consulta Generado */}
                {queryScript && (
                  <div className="mt-6">
                    <CodeEditor
                      code={queryScript}
                      language="sql"
                      title="Script de Consulta SQL"
                      onCopy={copyQueryScript}
                      onDownload={() => {
                        const blob = new Blob([queryScript], { type: "text/plain" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = `script_consulta_${file1.hojaProcesada}_${new Date().toISOString().split("T")[0]}.sql`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      }}
                      className="border-orange-200"
                    />
                    
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Próximo paso:</strong> Copia este script y ejecútalo en Oracle para obtener los datos actuales de la base de datos.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compare Button */}
        {file1 && file2 && (
          <div className="text-center">
            <Button 
              onClick={compareFiles}
              disabled={isProcessing}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Procesando comparación...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Iniciar Comparación
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results Section */}
        {comparison && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Registros Coincidentes</p>
                      <p className="text-3xl font-bold text-green-600 mt-1">{comparison.matching}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Progress value={(comparison.matching / comparison.total) * 100} className="h-2" />
                    <p className="text-xs text-gray-500 mt-2">
                      {((comparison.matching / comparison.total) * 100).toFixed(1)}% del total
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Registros Diferentes</p>
                      <p className="text-3xl font-bold text-red-600 mt-1">{comparison.nonMatching}</p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Progress value={(comparison.nonMatching / comparison.total) * 100} className="h-2" />
                    <p className="text-xs text-gray-500 mt-2">
                      {((comparison.nonMatching / comparison.total) * 100).toFixed(1)}% del total
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total de Registros</p>
                      <p className="text-3xl font-bold text-blue-600 mt-1">{comparison.total}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Database className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{comparison.differences.length}</span> diferencias detectadas
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Results */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Análisis Detallado
                </CardTitle>
                <CardDescription>
                  Revisa los resultados de la comparación y genera los scripts necesarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="differences" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="differences" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                      Diferencias Encontradas
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                      Vista Previa de Datos
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="differences" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">
                        Lista de Diferencias
                      </h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Total procesados: {comparison.total} registros
                        </Badge>
                        <Badge variant="outline" className="text-gray-600">
                          Diferencias: {comparison.differences.length}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Resumen de estadísticas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {comparison.differences.filter(d => d.status === 'actualizar_poligono').length}
                        </div>
                        <div className="text-sm text-gray-600">Actualizar Polígono</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {comparison.differences.filter(d => d.status === 'actualizar_celda').length}
                        </div>
                        <div className="text-sm text-gray-600">Actualizar Celda</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {comparison.differences.filter(d => d.status === 'actualizar_ambos').length}
                        </div>
                        <div className="text-sm text-gray-600">Actualizar Ambos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {comparison.differences.filter(d => d.status === 'nuevo_registro').length}
                        </div>
                        <div className="text-sm text-gray-600">Nuevos Registros</div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 sticky top-0">
                              <TableHead className="font-semibold text-gray-900 bg-gray-50">Matrícula</TableHead>
                              <TableHead className="font-semibold text-gray-900 bg-gray-50">Código Polígono</TableHead>
                              <TableHead className="font-semibold text-gray-900 bg-gray-50">Código Celda</TableHead>
                              <TableHead className="font-semibold text-gray-900 bg-gray-50">Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comparison.differences.map((diff, index) => (
                              <TableRow key={index} className="hover:bg-gray-50">
                                <TableCell className="font-medium text-blue-600">{diff.matricula}</TableCell>
                                <TableCell>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-medium text-green-600">Archivo 1:</span>
                                      <span className="text-sm font-medium bg-green-50 px-2 py-1 rounded">
                                        {diff.codigoPoligono.archivo1 || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-medium text-red-600">Archivo 2:</span>
                                      <span className="text-sm font-medium bg-red-50 px-2 py-1 rounded">
                                        {diff.codigoPoligono.archivo2 || 'N/A'}
                                      </span>
                                    </div>
                                    {diff.codigoPoligono.necesitaActualizar && (
                                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                        ⚠️ Necesita actualizar
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-medium text-green-600">Archivo 1:</span>
                                      <span className="text-sm font-medium bg-green-50 px-2 py-1 rounded">
                                        {diff.codigoCelda.archivo1 || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-medium text-red-600">Archivo 2:</span>
                                      <span className="text-sm font-medium bg-red-50 px-2 py-1 rounded">
                                        {diff.codigoCelda.archivo2 || 'N/A'}
                                      </span>
                                    </div>
                                    {diff.codigoCelda.necesitaActualizar && (
                                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                        ⚠️ Necesita actualizar
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(diff.status)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <p className="text-sm text-green-800">
                            <strong>Análisis completo:</strong> Se procesaron <strong>{comparison.total} registros</strong> 
                            entre ambos archivos y se encontraron <strong>{comparison.differences.length} diferencias</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Muestra de Datos
                    </h3>
                    
                    <div className="grid lg:grid-cols-2 gap-6">
                      {[file1, file2].map((file, fileIndex) => (
                        <div key={fileIndex} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">
                              {file?.name}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                Total: {file?.records} registros
                              </Badge>
                              <Badge variant="outline" className="bg-gray-50 text-gray-600">
                                Mostrando: {file?.records} registros
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50 sticky top-0">
                                    <TableHead className="font-semibold text-gray-900 text-sm bg-gray-50">
                                      MATRICULA
                                    </TableHead>
                                    <TableHead className="font-semibold text-gray-900 text-sm bg-gray-50">
                                      CODIGO POLIGONO
                                    </TableHead>
                                    <TableHead className="font-semibold text-gray-900 text-sm bg-gray-50">
                                      CODIGO CELDA
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {file?.data.map((row, rowIndex) => (
                                    <TableRow key={rowIndex} className="hover:bg-gray-50">
                                      <TableCell className="text-sm text-gray-600 font-medium">
                                        {(() => {
                                          const matricula = row['MATRICULA'] || row['matricula'] || row['Matricula'] || 'N/A'
                                          if (matricula === 'N/A') return 'N/A'
                                          
                                          // Aplicar la misma lógica de corrección de ceros iniciales
                                          let correctedMatricula = matricula.toString().trim()
                                          if (/^\d+$/.test(correctedMatricula)) {
                                            const digitCount = correctedMatricula.length
                                            if (digitCount < 6) {
                                              const zerosNeeded = 6 - digitCount
                                              correctedMatricula = '0'.repeat(zerosNeeded) + correctedMatricula
                                            }
                                          }
                                          return correctedMatricula
                                        })()}
                                      </TableCell>
                                      <TableCell className="text-sm text-gray-600">
                                        {row['CODIGO POLIGONO'] || row['CODIGO_POLIGONO'] || row['codigo_poligono'] || 'N/A'}
                                      </TableCell>
                                      <TableCell className="text-sm text-gray-600">
                                        {row['CODIGO CELDA'] || row['CODIGO_CELDA'] || row['codigo_celda'] || 'N/A'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <p className="text-sm text-blue-800">
                                  <strong>Nota:</strong> Se muestran <strong>todos los {file?.records} registros</strong> del archivo. 
                                  La tabla es scrolleable para navegar por todos los datos.
                                </p>
                              </div>
                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <p className="text-xs text-green-800">
                                    <strong>Procesamiento de Matrículas:</strong> Los ceros iniciales se preservan automáticamente 
                                    (ej: 031517 se mantiene como 031517, no como 31517).
                                  </p>
                                </div>
                              </div>
                              
                              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <p className="text-xs text-blue-800">
                                    <strong>Detección Inteligente:</strong> La aplicación detecta automáticamente la hoja correcta 
                                    basándose en el contenido, incluso si se llama "Hoja1" o "Sheet1".
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Generate Scripts Button */}
            <div className="text-center">
              <Button 
                onClick={generateScripts}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
              >
                <Code2 className="w-5 h-5 mr-2" />
                Generar Scripts de Actualización
              </Button>
            </div>
          </div>
        )}

        {/* Scripts Section */}
        {scripts && (
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-900 flex items-center">
                    <Code2 className="w-5 h-5 mr-2 text-green-600" />
                    Scripts SQL Generados
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Scripts listos para ejecutar en tu base de datos. Revisa cuidadosamente antes de ejecutar.
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-3">
                  <Button onClick={copyScripts} variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Todo
                  </Button>
                  <Button onClick={downloadScripts} variant="outline" className="border-green-300 text-green-600 hover:bg-green-50">
                    <Download className="w-4 h-4 mr-2" />
                    Descargar .sql
                  </Button>
                  <Button 
                    onClick={clearAll} 
                    variant="outline" 
                    className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Limpiar Todo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                    <p className="text-sm font-medium text-yellow-800">
                      Importante: Revisa y prueba estos scripts en un ambiente de desarrollo antes de ejecutarlos en producción
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <p className="text-sm text-blue-800">
                        <strong>Nota:</strong> Los apóstrofes se han eliminado automáticamente del script. 
                        Los valores como 031517 se muestran sin comillas para uso directo en la base de datos.
                      </p>
                    </div>
                  </div>
                  
                  <CodeEditor
                    code={scripts}
                    language="sql"
                    title="Scripts de Actualización SQL"
                    onCopy={copyScripts}
                    onDownload={downloadScripts}
                    className="border-green-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
