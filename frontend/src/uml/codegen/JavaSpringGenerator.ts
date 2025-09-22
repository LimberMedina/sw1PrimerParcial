// src/uml/codegen/JavaSpringGenerator.ts

export interface ClassDefinition {
  name: string;
  attributes: string[];
  methods: string[];
}

export interface RelationDefinition {
  source: string;
  target: string;
  type: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';
  bidirectional: boolean;
}

export class JavaSpringGenerator {
  private classes: ClassDefinition[] = [];
  private relations: RelationDefinition[] = [];
  private packageName: string;

  constructor(packageName: string = 'com.example') {
    this.packageName = packageName;
  }

  addClass(cls: ClassDefinition) {
    this.classes.push(cls);
  }

  addRelation(relation: RelationDefinition) {
    this.relations.push(relation);
  }

  private toCamelCase(str: string): string {
    const camelCase = str.charAt(0).toLowerCase() + str.slice(1);
    // Evitar palabras reservadas de Java
    const reservedWords = ['class', 'interface', 'abstract', 'public', 'private', 'protected', 'static', 'final', 'volatile', 'transient', 'synchronized', 'native', 'strictfp'];
    if (reservedWords.includes(camelCase)) {
      return camelCase + 'Entity';
    }
    return camelCase;
  }

  private toPlural(str: string): string {
    // Reglas básicas de pluralización en inglés
    if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
      return str + 'es';
    } else if (str.endsWith('y') && str.length > 1) {
      return str.slice(0, -1) + 'ies';
    } else if (str.endsWith('f')) {
      return str.slice(0, -1) + 'ves';
    } else if (str.endsWith('fe')) {
      return str.slice(0, -2) + 'ves';
    } else {
      return str + 's';
    }
  }

  private generateImports() {
    return `package ${this.packageName}.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;
import com.fasterxml.jackson.annotation.*;

`;
  }

  private generateClass(cls: ClassDefinition): string {
    const className = cls.name;
    const varName = this.toCamelCase(className);
    
    // Generar atributos
    const attributes = cls.attributes.map(attr => {
      const trimmedAttr = attr.trim();
      if (!trimmedAttr) return '';
      
      // Buscar el último espacio para separar tipo y nombre
      const lastSpaceIndex = trimmedAttr.lastIndexOf(' ');
      if (lastSpaceIndex === -1) {
        // Si no hay espacio, asumir que es solo el nombre y usar String como tipo por defecto
        return `    @Column(name = "${trimmedAttr.toLowerCase()}")
    private String ${trimmedAttr};`;
      }
      
      const type = trimmedAttr.substring(0, lastSpaceIndex).trim();
      const name = trimmedAttr.substring(lastSpaceIndex + 1).trim();
      
      if (!type || !name) return '';
      
      return `    @Column(name = "${name.toLowerCase()}")
    private ${type} ${name};`;
    }).filter(Boolean).join('\n\n');

    // Generar relaciones
    const relations = this.relations
      .filter(rel => rel.source === className || rel.target === className)
      .map(rel => {
        const isSource = rel.source === className;
        const targetClass = isSource ? rel.target : rel.source;
        const targetVar = this.toCamelCase(targetClass);
        
        let relationCode = '';
        
        if (rel.type === 'ONE_TO_ONE') {
          relationCode = `    @OneToOne(cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JoinColumn(name = "${this.toCamelCase(targetClass)}_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ${targetClass} ${targetVar};`;
        } else if (rel.type === 'MANY_TO_ONE' && isSource) {
          relationCode = `    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "${this.toCamelCase(targetClass)}_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ${targetClass} ${targetVar};`;
        } else if (rel.type === 'ONE_TO_MANY' && !isSource) {
          relationCode = `    @OneToMany(mappedBy = "${targetVar}", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @JsonManagedReference
    private Set<${targetClass}> ${this.toPlural(targetVar)} = new HashSet<>();`;
        } else if (rel.type === 'MANY_TO_MANY') {
          const joinTable = `${className.toLowerCase()}_${targetClass.toLowerCase()}`;
            
          relationCode = `    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "${joinTable}",
        joinColumns = @JoinColumn(name = "${this.toCamelCase(className)}_id"),
        inverseJoinColumns = @JoinColumn(name = "${this.toCamelCase(targetClass)}_id")
    )
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Set<${targetClass}> ${this.toPlural(targetVar)} = new HashSet<>();`;
        }
        
        return relationCode;
      }).filter(Boolean).join('\n\n');

    // Los getters y setters se generan automáticamente con Lombok @Getter y @Setter

    return `${this.generateImports()}
@Entity
@Table(name = "${this.toPlural(className.toLowerCase())}")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ${className} {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

${[attributes, relations].filter(Boolean).join('\n\n')}

    // Equals and HashCode
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${className} ${varName} = (${className}) o;
        return Objects.equals(id, ${varName}.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    // ToString
    @Override
    public String toString() {
        return "${className}{" +
                "id=" + id +
                '}';
    }
}`;
  }

  generateAll(): Record<string, string> {
    const result: Record<string, string> = {};
    
    // Generar entidades
    this.classes.forEach(cls => {
      result[`${cls.name}.java`] = this.generateClass(cls);
    });
    
    // Generar DTOs
    this.classes.forEach(cls => {
      result[`${cls.name}DTO.java`] = this.generateDTO(cls);
    });
    
    // Generar repositorios
    this.classes.forEach(cls => {
      result[`${cls.name}Repository.java`] = this.generateRepository(cls);
    });
    
    // Generar servicios
    this.classes.forEach(cls => {
      result[`${cls.name}Service.java`] = this.generateService(cls);
    });
    
    // Generar controladores
    this.classes.forEach(cls => {
      result[`${cls.name}Controller.java`] = this.generateController(cls);
    });
    
    return result;
  }

  private generateDTO(cls: ClassDefinition): string {
    const attributes = cls.attributes.map(attr => {
      const trimmedAttr = attr.trim();
      if (!trimmedAttr) return '';
      
      // Buscar el último espacio para separar tipo y nombre
      const lastSpaceIndex = trimmedAttr.lastIndexOf(' ');
      if (lastSpaceIndex === -1) {
        // Si no hay espacio, asumir que es solo el nombre y usar String como tipo por defecto
        return `    private String ${trimmedAttr};`;
      }
      
      const type = trimmedAttr.substring(0, lastSpaceIndex).trim();
      const name = trimmedAttr.substring(lastSpaceIndex + 1).trim();
      
      if (!type || !name) return '';
      
      return `    private ${type} ${name};`;
    }).filter(Boolean);

    return `package ${this.packageName}.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ${cls.name}DTO {
    private Long id;
${attributes.length > 0 ? '\n' + attributes.join('\n') : ''}
}`;
  }

  private generateRepository(cls: ClassDefinition): string {
    return `package ${this.packageName}.repository;

import ${this.packageName}.model.${cls.name};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ${cls.name}Repository extends JpaRepository<${cls.name}, Long> {
    // Métodos de consulta personalizados pueden agregarse aquí
}`;
  }

  private generateService(cls: ClassDefinition): string {
    const varName = this.toCamelCase(cls.name);
    const repoVarName = `${varName}Repository`;
    const dtoName = `${cls.name}DTO`;
    
    return `package ${this.packageName}.service;

import ${this.packageName}.dto.${dtoName};
import ${this.packageName}.model.${cls.name};
import ${this.packageName}.repository.${cls.name}Repository;
import org.modelmapper.ModelMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ${cls.name}Service {

    private final ${cls.name}Repository ${repoVarName};
    private final ModelMapper modelMapper;
    
    public ${cls.name}Service(${cls.name}Repository ${repoVarName}, ModelMapper modelMapper) {
        this.${repoVarName} = ${repoVarName};
        this.modelMapper = modelMapper;
    }
    
    public List<${dtoName}> findAll() {
        return ${repoVarName}.findAll().stream()
                .map(${varName} -> modelMapper.map(${varName}, ${dtoName}.class))
                .collect(Collectors.toList());
    }
    
    public ${dtoName} findById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("ID cannot be null");
        }
        ${cls.name} ${varName} = ${repoVarName}.findById(id)
                .orElseThrow(() -> new RuntimeException("${cls.name} not found with id: " + id));
        return modelMapper.map(${varName}, ${dtoName}.class);
    }
    
    public ${dtoName} create(${dtoName} ${varName}Dto) {
        if (${varName}Dto == null) {
            throw new IllegalArgumentException("${cls.name}DTO cannot be null");
        }
        ${cls.name} ${varName} = modelMapper.map(${varName}Dto, ${cls.name}.class);
        return modelMapper.map(${repoVarName}.save(${varName}), ${dtoName}.class);
    }
    
    public ${dtoName} update(Long id, ${dtoName} ${varName}Dto) {
        if (id == null) {
            throw new IllegalArgumentException("ID cannot be null");
        }
        if (${varName}Dto == null) {
            throw new IllegalArgumentException("${cls.name}DTO cannot be null");
        }
        ${cls.name} existing${cls.name} = ${repoVarName}.findById(id)
                .orElseThrow(() -> new RuntimeException("${cls.name} not found with id: " + id));
                
        modelMapper.map(${varName}Dto, existing${cls.name});
        existing${cls.name}.setId(id);
        
        return modelMapper.map(${repoVarName}.save(existing${cls.name}), ${dtoName}.class);
    }
    
    public void delete(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("ID cannot be null");
        }
        if (!${repoVarName}.existsById(id)) {
            throw new RuntimeException("${cls.name} not found with id: " + id);
        }
        ${repoVarName}.deleteById(id);
    }
}`;
  }

  private generateController(cls: ClassDefinition): string {
    const varName = this.toCamelCase(cls.name);
    const dtoName = `${cls.name}DTO`;
    const path = `"/api/${this.toPlural(varName)}"`;
    
    return `package ${this.packageName}.controller;

import ${this.packageName}.dto.${dtoName};
import ${this.packageName}.service.${cls.name}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(${path})
public class ${cls.name}Controller {

    private final ${cls.name}Service ${varName}Service;
    
    public ${cls.name}Controller(${cls.name}Service ${varName}Service) {
        this.${varName}Service = ${varName}Service;
    }
    
    @GetMapping
    public ResponseEntity<List<${dtoName}>> getAll() {
        return ResponseEntity.ok(${varName}Service.findAll());
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<${dtoName}> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(${varName}Service.findById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    @PostMapping
    public ResponseEntity<${dtoName}> create(@RequestBody ${dtoName} ${varName}Dto) {
        try {
            return ResponseEntity.ok(${varName}Service.create(${varName}Dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<${dtoName}> update(
            @PathVariable Long id, 
            @RequestBody ${dtoName} ${varName}Dto) {
        try {
            return ResponseEntity.ok(${varName}Service.update(id, ${varName}Dto));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        try {
            ${varName}Service.delete(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}`;
  }
}
