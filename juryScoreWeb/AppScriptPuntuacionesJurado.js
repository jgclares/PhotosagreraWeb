// La función doPost se activa cuando la Web App recibe una solicitud POST.
function doPost(e) { 
  // Parsear el JSON recibido del HTML
  const data = JSON.parse(e.postData.contents);
  const juradoName = data.juradoName;
  const month = data.month;
  const scores = data.scores;

  logToSheet(`Recibida puntuación de ${data.juradoName} para el mes ${data.month}`); 
  // Asegurarse de que el cuerpo de la solicitud no esté vacío
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput("Error: No data received.");
  }



  // Obtener la hoja de cálculo activa y la hoja de destino
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(month); // Asegúrate de que este nombre coincida con el de tu hoja
  if (!sheet) {
    return ContentService.createTextOutput(`No s'ha trobat el full per a les puntuacions del mes ${month}.`).setMimeType(ContentService.MimeType.TEXT);
  }

  // Encuentra la siguiente columna vacía
  const lastCol = sheet.getLastColumn();
  const newCol = lastCol + 1;

  // Escribe el nombre del jurado en la cabecera
  sheet.getRange(1, newCol).setValue(juradoName);

  // Inserta cada puntuación en la fila correspondiente
  for (let i = 0; i < scores.length; i++) {
    // +2 porque la primera fila es cabecera y los datos empiezan en la segunda
    sheet.getRange(i + 2, newCol).setValue(scores[i]);
  }

  // Devolver una respuesta para indicar que la operación fue exitosa
  // logToSheet('Devolver una respuesta para indicar que la operación fue exitosa');
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

// La función doGet se activa cuando la Web App recibe una solicitud GET.
// Esta función devuelve el número de filas de datos en la hoja 'Puntuaciones'. 
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'info';

    // If caller requests an image id for a specific row
    if (action === 'getImageId') {
      try {
        const sheetName = e.parameter.sheetName || '';
        const rowNumber = parseInt(e.parameter.rowNumber, 10);
        const imageId = getImageIdFromSheet(sheetName, rowNumber);
        return ContentService.createTextOutput(JSON.stringify({
          imageId: imageId,
          status: "success"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          error: err.toString(),
          status: "error"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Default behavior: return config and numRows
    // Get configuration first
    let config;
    try {
      config = readConfig();
    } catch (configError) {
      // Return early with config error
      return ContentService.createTextOutput(JSON.stringify({
        error: `Error llegint configuració: ${configError.message}`,
        status: "error"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.MES_ACTUAL);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        error: `No s'ha trobat el full per a les puntuacions del mes ${config.MES_ACTUAL}.`,
        status: "error"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const numRows = sheet.getLastRow() - 1;
    
    return ContentService.createTextOutput(JSON.stringify({
      numRows: numRows,
      config: config,
      status: "success"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString(),
      status: "error"
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


function readConfig() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  if (!sheet) {
    throw new Error("Config sheet not found");
  }

  // Get all data from the Config sheet
  const data = sheet.getDataRange().getValues();
  
  // Create a dictionary to store the config pairs
  const config = {};
  
  // Skip header row if exists, start from row 1
  for (let i = 1; i < data.length; i++) {
    const param_name = data[i][0];  // Column 1
    const value_name = data[i][1];  // Column 2
    if (param_name) {  // Only add if param_name is not empty
      config[param_name] = value_name;
    }
  }
  
  return config;
}


// Función para registrar mensajes en una hoja de cálculo llamada "Logs"
function logToSheet(message) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Logs");
  if (!sheet) return;
  sheet.appendRow([new Date(), message]);
}


// La función getImageIdFromSheet se activa cuando la Web App recibe una solicitud GET
// Función para extraer el ID de imagen de la columna J
function getImageIdFromSheet(sheetName, rowNumber) {
  try {
    let targetSheetName = sheetName;
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(targetSheetName);
    
    if (!sheet) {
      const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
      if (configSheet) {
        targetSheetName = configSheet.getRange("B2").getValue();
        sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(targetSheetName);
      }
    }
    
    if (!sheet) {
      throw new Error(`Sheet "${targetSheetName}" not found`);
    }
    
    // Row+1 skip headers row Column J is column 10
    const imageUrl = sheet.getRange(rowNumber+1, 10).getValue();
    
    if (!imageUrl || imageUrl.trim() === "") {
      return null;
    }
    
    // Extract image ID from Google Drive URL
    const imageId = extractImageIdFromUrl(imageUrl);
    
    return imageId;
  } catch (error) {
    logToSheet(`Error getting image ID from sheet ${sheetName}, row ${rowNumber}: ${error.message}`);
    return null;
  }
}

// Función para extraer el ID de una URL de Google Drive
function extractImageIdFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  // Pattern 1: /d/{id}/ (most common Google Drive share URLs)
  let match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  
  // Pattern 2: id={id} (query parameter)
  match = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  
  // Pattern 3: Direct ID (already just an ID)
  if (/^[a-zA-Z0-9-_]+$/.test(url) && url.length > 20) {
    return url;
  }
  
  return null;
}





