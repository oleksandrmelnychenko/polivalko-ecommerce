begin;

delete from catalog.products where navkolo_id like 'syn-%';

delete from catalog.categories c
where c.parent_id is not null
  and c.navkolo_ref = c.name
  and c.name in (
    'Шланги поливальні', 'Розпилювачі й пістолети', 'Дощувачі', 'Крапельний полив', 'Бочки й ємності',
    'Ґрунти й субстрати', 'Добрива', 'Насіння', 'Горщики й кашпо', 'Захист рослин',
    'Лопати й вила', 'Секатори й ножиці', 'Граблі й сапи', 'Пили й сокири',
    'Газонокосарки', 'Тримери й мотокоси', 'Мотоблоки й культиватори', 'Повітродуви й пилососи', 'Мийки високого тиску',
    'Меблі садові', 'Гриль і барбекю', 'Гамаки й намети', 'Басейни',
    'Прибирання', 'Зберігання', 'Господарські дрібниці',
    'Бордюри й огорожі', 'Декор і фігури', 'Мульча й каміння',
    'Ялинки', 'Гірлянди', 'Прикраси')
  and not exists (select 1 from catalog.products p where p.category_id = c.id)
  and not exists (select 1 from catalog.categories k where k.parent_id = c.id);

delete from catalog.brands b
where b.description is null
  and b.logo_url is null
  and not exists (select 1 from catalog.products p where p.brand = b.name);

delete from catalog.attribute_definitions d
where d.unit is null
  and cardinality(d.aliases) = 0
  and not exists (select 1 from catalog.product_attributes a where a.name = d.name)
  and not exists (select 1 from catalog.categories c where d.name = any (c.filter_attributes));

commit;
