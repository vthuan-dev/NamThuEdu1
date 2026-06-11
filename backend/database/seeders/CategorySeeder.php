<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // caId phải khớp với categoryOptions hardcode ở frontend (CreatePost.tsx)
        $categories = [
            ['caId' => 1, 'caName' => 'IELTS',           'caType' => 'IELTS'],
            ['caId' => 2, 'caName' => 'TOEFL',           'caType' => 'GENERAL'],
            ['caId' => 3, 'caName' => 'Cambridge',       'caType' => 'GENERAL'],
            ['caId' => 4, 'caName' => 'General English', 'caType' => 'GENERAL'],
            ['caId' => 5, 'caName' => 'VSTEP',           'caType' => 'VSTEP'],
        ];

        foreach ($categories as $category) {
            Category::updateOrCreate(['caId' => $category['caId']], $category);
        }
    }
}
