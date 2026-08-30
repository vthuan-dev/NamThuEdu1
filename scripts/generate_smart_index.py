import os
import re
import sys

def parse_php_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        return f"Error reading file: {e}"

    # Extract namespace
    ns_match = re.search(r'namespace\s+([^;]+);', content)
    namespace = ns_match.group(1) if ns_match else ""

    # Extract class/interface/trait
    class_match = re.search(r'(class|interface|trait)\s+(\w+)(?:\s+extends\s+(\w+))?', content)
    class_info = ""
    if class_match:
        class_type = class_match.group(1)
        class_name = class_match.group(2)
        extends_name = class_match.group(3)
        if extends_name:
            class_info = f"{class_type} {class_name} extends {extends_name}"
        else:
            class_info = f"{class_type} {class_name}"

    # Extract public/protected variables/properties
    # Matches: public $var; protected string $name; public readonly User $user;
    properties = re.findall(r'(?:public|protected)\s+(?:readonly\s+)?(?:[\w\\]+(?:\s*\|?\s*[\w\\]+)*\s+)?\$(\w+)', content)
    
    # Extract public methods
    methods = re.findall(r'public\s+function\s+(\w+)\s*\(', content)
    filtered_methods = [m for m in methods if not m.startswith('__')]
    
    summary = []
    if class_info:
        summary.append(class_info)
    if properties:
        summary.append(f"Props: {', '.join(sorted(list(set(properties))))}")
    if filtered_methods:
        summary.append(f"Methods: {', '.join(filtered_methods)}")
        
    return " | ".join(summary) if summary else "PHP File"

def parse_ts_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        return f"Error reading file: {e}"

    exports = []
    
    # 1. Export functions
    func_matches = re.findall(r'export\s+(?:default\s+)?function\s+(\w+)', content)
    exports.extend(func_matches)
    
    # 2. Export const/let/var variables and constants (ALL of them, down to every single variable)
    const_matches = re.findall(r'export\s+(?:const|let|var)\s+(\w+)', content)
    exports.extend(const_matches)
    
    # 3. Export default values
    default_match = re.search(r'export\s+default\s+(\w+)', content)
    if default_match:
        val = default_match.group(1)
        if val not in exports:
            exports.append(f"default {val}")
            
    # 4. Interfaces/Types exported
    type_matches = re.findall(r'export\s+(?:interface|type)\s+(\w+)', content)

    # 5. Classes exported
    class_matches = re.findall(r'export\s+class\s+(\w+)', content)
    exports.extend(class_matches)

    exports = sorted(list(set(exports))) # Unique & sorted
    type_matches = sorted(list(set(type_matches)))
    
    summary = []
    if exports:
        summary.append(f"Exports/Vars: {', '.join(exports)}")
    if type_matches:
        summary.append(f"Types: {', '.join(type_matches)}")
        
    return " | ".join(summary) if summary else "TypeScript File"

def scan_directory():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print(f"Scanning root directory: {root_dir}")
    
    backend_dir = os.path.join(root_dir, "backend", "app")
    frontend_dir = os.path.join(root_dir, "frontend", "src")
    
    output_lines = []
    output_lines.append("# NamThuEdu Codebase Index (Exhaustive Structural Index)\n")
    output_lines.append("> This file lists all core source files, their size, and every single public method, class property, exported variable, constant, class, and interface to save context tokens during development.\n")
    
    # 1. Scan Backend
    output_lines.append("## 1. BACKEND CODES (`backend/app/`)\n")
    
    backend_categories = {
        "Controllers": "Http/Controllers",
        "Models": "Models",
        "Services": "Services",
        "Middleware": "Http/Middleware",
        "Console Commands": "Console/Commands",
        "Events & Jobs": ["Events", "Jobs", "Mail", "Notifications"]
    }
    
    for cat_name, rel_path in backend_categories.items():
        output_lines.append(f"### {cat_name}\n")
        output_lines.append("| File Path | Size (KB) | Structure Summary |")
        output_lines.append("|---|---|---|")
        
        paths_to_scan = []
        if isinstance(rel_path, list):
            for rp in rel_path:
                full_p = os.path.join(backend_dir, rp)
                if os.path.exists(full_p):
                    paths_to_scan.append((rp, full_p))
        else:
            full_p = os.path.join(backend_dir, rel_path)
            if os.path.exists(full_p):
                paths_to_scan.append((rel_path, full_p))
                
        files_found = []
        for rp, fp in paths_to_scan:
            for root, dirs, files in os.walk(fp):
                for file in files:
                    if file.endswith('.php'):
                        full_filepath = os.path.join(root, file)
                        rel_filepath = os.path.relpath(full_filepath, root_dir).replace('\\', '/')
                        size_kb = os.path.getsize(full_filepath) / 1024.0
                        files_found.append((rel_filepath, full_filepath, size_kb))
                        
        files_found.sort(key=lambda x: x[0])
        for rel_filepath, full_filepath, size_kb in files_found:
            summary = parse_php_file(full_filepath)
            summary = summary.replace('|', '\\|')
            output_lines.append(f"| [{os.path.basename(rel_filepath)}](file:///{root_dir}/{rel_filepath}) | {size_kb:.1f} KB | {summary} |")
        output_lines.append("")
        
    # 2. Scan Frontend
    output_lines.append("## 2. FRONTEND CODES (`frontend/src/`)\n")
    
    frontend_categories = {
        "Routes & Layouts": ["app/routes", "app/layouts", "app/App.tsx", "main.tsx"],
        "API Services": ["services"],
        "Auth Features": ["app/features/auth"],
        "Public Features": ["app/features/public"],
        "Student Features": ["app/features/student"],
        "Teacher Features": ["app/features/teacher"],
        "Admin Features": ["app/features/admin"],
        "Shared Components": ["components"],
        "Hooks": ["hooks"],
        "Contexts & Themes": ["contexts", "themes"],
        "Types & Utils": ["types", "utils"]
    }
    
    for cat_name, subpaths in frontend_categories.items():
        output_lines.append(f"### {cat_name}\n")
        output_lines.append("| File Path | Size (KB) | Structure Summary |")
        output_lines.append("|---|---|---|")
        
        files_found = []
        for subpath in subpaths:
            full_p = os.path.join(frontend_dir, subpath)
            if not os.path.exists(full_p):
                full_p = os.path.join(frontend_dir, subpath)
                
            if os.path.isdir(full_p):
                for root, dirs, files in os.walk(full_p):
                    if '__tests__' in root or 'node_modules' in root:
                        continue
                    for file in files:
                        if file.endswith(('.ts', '.tsx')) and not file.endswith('.test.ts') and not file.endswith('.test.tsx'):
                            full_filepath = os.path.join(root, file)
                            rel_filepath = os.path.relpath(full_filepath, root_dir).replace('\\', '/')
                            size_kb = os.path.getsize(full_filepath) / 1024.0
                            files_found.append((rel_filepath, full_filepath, size_kb))
            elif os.path.isfile(full_p):
                rel_filepath = os.path.relpath(full_p, root_dir).replace('\\', '/')
                size_kb = os.path.getsize(full_p) / 1024.0
                files_found.append((rel_filepath, full_p, size_kb))
                
        files_found.sort(key=lambda x: x[0])
        for rel_filepath, full_filepath, size_kb in files_found:
            summary = parse_ts_file(full_filepath)
            summary = summary.replace('|', '\\|')
            output_lines.append(f"| [{os.path.basename(rel_filepath)}](file:///{root_dir}/{rel_filepath}) | {size_kb:.1f} KB | {summary} |")
        output_lines.append("")

    index_path = os.path.join(root_dir, "CODEBASE-INDEX.md")
    print(f"Writing to {index_path}")
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(output_lines))
    print("Done!")

if __name__ == "__main__":
    scan_directory()
