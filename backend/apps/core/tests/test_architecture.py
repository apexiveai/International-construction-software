
import unittest

from apps.core.architecture import (
    MODULES,
    ProductModule,
    ProductLayer,
    RuntimeTarget,
    dependency_order,
    get_module_registry,
    modules_by_layer,
    validate_registry,
)


class ArchitectureRegistryTests(unittest.TestCase):

    def test_official_registry_is_valid(self):
        validate_registry()

    def test_module_keys_are_unique(self):
        keys = [module.key for module in MODULES]
        self.assertEqual(len(keys), len(set(keys)))

    def test_all_dependencies_exist(self):
        registry = get_module_registry()

        for module in MODULES:
            for dependency in module.dependencies:
                self.assertIn(dependency, registry)

    def test_dependency_order_places_dependencies_first(self):
        registry = get_module_registry()
        order = dependency_order()
        positions = {
            key: index
            for index, key in enumerate(order)
        }

        for module in MODULES:
            for dependency in module.dependencies:
                self.assertLess(
                    positions[dependency],
                    positions[module.key],
                )

    def test_duplicate_module_key_is_rejected(self):
        module = ProductModule(
            key="test",
            name="Test",
            layer=ProductLayer.PLATFORM,
            targets=(RuntimeTarget.BACKEND,),
            description="Test module",
        )

        with self.assertRaises(ValueError):
            validate_registry((module, module))

    def test_unknown_dependency_is_rejected(self):
        module = ProductModule(
            key="test",
            name="Test",
            layer=ProductLayer.PLATFORM,
            targets=(RuntimeTarget.BACKEND,),
            description="Test module",
            dependencies=("missing_module",),
        )

        with self.assertRaises(ValueError):
            validate_registry((module,))

    def test_circular_dependency_is_rejected(self):
        module_a = ProductModule(
            key="module_a",
            name="Module A",
            layer=ProductLayer.PLATFORM,
            targets=(RuntimeTarget.BACKEND,),
            description="Module A",
            dependencies=("module_b",),
        )

        module_b = ProductModule(
            key="module_b",
            name="Module B",
            layer=ProductLayer.PLATFORM,
            targets=(RuntimeTarget.BACKEND,),
            description="Module B",
            dependencies=("module_a",),
        )

        with self.assertRaises(ValueError):
            validate_registry((module_a, module_b))

    def test_modules_are_grouped_by_layer(self):
        grouped = modules_by_layer()

        self.assertIn("platform", grouped)
        self.assertIn("authoring", grouped)
        self.assertIn("engineering", grouped)
        self.assertIn("construction", grouped)


if __name__ == "__main__":
    unittest.main()
