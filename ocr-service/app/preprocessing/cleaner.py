import re

def clean_text(text: str) -> str:
    """
    Intelligent preprocessing for OCR text:
    - Normalizes spacing
    - Fixes broken lines
    - Removes common OCR noise
    """
    if not text:
        return ""
        
    # Replace multiple spaces with a single space (except newlines)
    text = re.sub(r'[^\S\n]+', ' ', text)
    
    # Remove empty lines
    lines = [line.strip() for line in text.split('\n')]
    lines = [line for line in lines if line]
    
    # Basic fusion of broken lines: if a line ends with a comma, or the next starts with a lowercase
    # This is a simple heuristic, but CRF uses context anyway.
    cleaned_lines = []
    for line in lines:
        if cleaned_lines and re.match(r'^[a-z]', line) and len(cleaned_lines[-1]) > 0 and not cleaned_lines[-1][-1].isdigit():
            # Append to previous line
            cleaned_lines[-1] += " " + line
        else:
            cleaned_lines.append(line)
            
    return "\n".join(cleaned_lines)
