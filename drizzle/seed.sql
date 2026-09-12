-- VUKA Academy demo seed
-- Run after the generated migration against a fresh database.
-- All records below are demo content and can be replaced without changing the frontend contracts.

INSERT INTO roles (`key`, `label`, `description`) VALUES
  ('admin', 'Administrador', 'Controlo global da plataforma e da gestão de cursos.'),
  ('formador', 'Formador', 'Gere conteúdos, testes, trabalhos e desempenho dos seus cursos.'),
  ('estudante', 'Estudante', 'Aprende, acompanha progresso e obtém certificados.'),
  ('empresa', 'Empresa', 'Forma colaboradores e acompanha resultados da equipa.')
ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description);

INSERT INTO categories (name, slug, description) VALUES
  ('Dados & tecnologia', 'dados-tecnologia', 'Competências digitais para trabalhar melhor com dados e ferramentas.'),
  ('Negócios & gestão', 'negocios-gestao', 'Gestão, operações e tomada de decisão para contextos reais.'),
  ('Desenvolvimento pessoal', 'desenvolvimento-pessoal', 'Competências humanas para crescer com confiança.'),
  ('Carreira & liderança', 'carreira-lideranca', 'Percursos para liderar pessoas, projetos e mudanças.')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

INSERT INTO courses (categoryId, title, slug, description, level, price, currency, status, certificateEnabled, requirements, objectives)
SELECT id, 'Fundamentos de Gestão de Projetos', 'fundamentos-gestao-projetos', 'Aprenda a planear, executar e entregar projetos com mais clareza, ritmo e impacto.', 'iniciante', 0.00, 'MZN', 'published', true, 'Não é necessária experiência prévia.', 'Organizar projetos, definir prioridades e comunicar resultados.'
FROM categories WHERE slug = 'negocios-gestao'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), status = VALUES(status);

INSERT INTO courses (categoryId, title, slug, description, level, price, currency, status, certificateEnabled, requirements, objectives)
SELECT id, 'Excel para Decisões Profissionais', 'excel-decisoes-profissionais', 'Transforme dados do dia a dia em análises úteis para decidir com confiança.', 'intermedio', 1450.00, 'MZN', 'published', true, 'Conhecimentos básicos de folhas de cálculo.', 'Criar análises, organizar informação e apresentar indicadores.'
FROM categories WHERE slug = 'dados-tecnologia'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), status = VALUES(status);

INSERT INTO courses (categoryId, title, slug, description, level, price, currency, status, certificateEnabled, requirements, objectives)
SELECT id, 'Comunicação para Lideranças', 'comunicacao-para-liderancas', 'Construa uma comunicação mais estratégica, humana e preparada para crescer.', 'intermedio', 980.00, 'MZN', 'published', true, 'Vontade de praticar e receber feedback.', 'Comunicar decisões, liderar conversas e criar alinhamento.'
FROM categories WHERE slug = 'carreira-lideranca'
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), status = VALUES(status);

INSERT INTO modules (courseId, title, position)
SELECT id, 'Começar com clareza', 1 FROM courses WHERE slug = 'fundamentos-gestao-projetos'
  AND NOT EXISTS (SELECT 1 FROM modules m WHERE m.courseId = courses.id AND m.title = 'Começar com clareza');

INSERT INTO modules (courseId, title, position)
SELECT id, 'Aplicar no dia a dia', 2 FROM courses WHERE slug = 'fundamentos-gestao-projetos'
  AND NOT EXISTS (SELECT 1 FROM modules m WHERE m.courseId = courses.id AND m.title = 'Aplicar no dia a dia');

INSERT INTO lessons (moduleId, title, description, type, durationMinutes, position, isPublished)
SELECT id, 'O que faz um projeto avançar', 'Uma introdução aos elementos essenciais de um projeto bem conduzido.', 'video', 14, 1, true
FROM modules WHERE title = 'Começar com clareza'
  AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.moduleId = modules.id AND l.title = 'O que faz um projeto avançar');

INSERT INTO lessons (moduleId, title, description, type, durationMinutes, position, isPublished)
SELECT id, 'Definir prioridades', 'Como transformar objetivos em próximos passos concretos.', 'text', 12, 2, true
FROM modules WHERE title = 'Começar com clareza'
  AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.moduleId = modules.id AND l.title = 'Definir prioridades');

INSERT INTO lessons (moduleId, title, description, type, durationMinutes, position, isPublished)
SELECT id, 'Construir um plano simples', 'Um modelo prático para organizar a execução e comunicar o caminho.', 'pdf', 18, 1, true
FROM modules WHERE title = 'Aplicar no dia a dia'
  AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.moduleId = modules.id AND l.title = 'Construir um plano simples');
